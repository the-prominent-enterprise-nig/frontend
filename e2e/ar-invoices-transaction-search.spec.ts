import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

let createdCustomerId: string | undefined

test.afterEach(async ({ page }) => {
  // Soft-deletes (sets deletedAt) — drops out of the Customers list
  // immediately, consistent with pos-transaction-detail-invoices.spec.ts.
  if (createdCustomerId) {
    await page.request.delete(`/api/crm/customers/${createdCustomerId}`)
    createdCustomerId = undefined
  }
})

// Scenario 23 Gap 4 — the AR Invoices screen's search now accepts a POS
// transaction number as an alternate lookup key, resolved server-side
// through the PosTransaction/InstallmentScheduleLine relation instead of
// the old accidental description-contains text match. Backend correctness
// (the structured lookup itself, both charge and installment cases) is
// covered by pos-credit-enforcement.e2e-spec.ts (CE-04) and
// pos-installment-financing.e2e-spec.ts (IF-03) — this spec sticks to the
// UI surface: does the new search input on the AR Invoices screen actually
// exist and work (there was no search input on this screen at all before
// this part).

async function ensureOpenSession(page: import('@playwright/test').Page, branchId: string) {
  const terminalsRes = await page.request.get('/api/pos/terminals', { params: { branchId } })
  const terminals = (await terminalsRes.json()) as { id: string; status: string }[]
  const terminal = terminals.find((t) => t.status === 'active') ?? terminals[0]

  const sessionsRes = await page.request.get('/api/pos/sessions', {
    params: { terminalId: terminal.id, status: 'open' },
  })
  const openSessions = (await sessionsRes.json()) as { id: string }[]
  for (const s of openSessions) {
    await page.request.post(`/api/pos/sessions/${s.id}/close`, { data: { declaredClosingCash: 0 } })
  }

  const openRes = await page.request.post('/api/pos/sessions/open', {
    data: { terminalId: terminal.id, openingCash: 1000 },
  })
  const session = await openRes.json()
  return session.id as string
}

test('searching AR Invoices by the POS transaction number finds its charge invoice', async ({
  page,
}) => {
  const applicantName = `E2E AR Search ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: {
      name: applicantName,
      customerType: 'individual',
      phone: '09170006677',
      creditLimit: 200000,
    },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  const branchesRes = await page.request.get('/api/branches?limit=200')
  const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
  const branchId = branches.find((b) => b.name === 'Bago')!.id
  const sessionId = await ensureOpenSession(page, branchId)

  // Same item several other specs already rely on being in stock at every
  // branch, rather than an arbitrary first result that might have none.
  const itemsRes = await page.request.get('/api/inventory/items', {
    params: { search: 'Universal Remote Control', limit: '1' },
  })
  const items = ((await itemsRes.json()).data ?? []) as {
    id: string
    name: string
    sellingPrice: number
  }[]
  const item = items[0]

  const txRes = await page.request.post('/api/pos/transactions', {
    data: {
      sessionId,
      customerId: customer.id,
      invoiceType: 'charge',
      subtotal: item.sellingPrice,
      totalAmount: item.sellingPrice,
      currency: 'PHP',
      lines: [{ itemId: item.id, itemName: item.name, quantity: 1, unitPrice: item.sellingPrice }],
    },
  })
  expect(txRes.ok()).toBeTruthy()
  const created = await txRes.json()
  expect(created.status).toBe('completed')
  const transactionNumber = created.transactionNumber as string
  const invoiceNumber = created.invoices[0].invoiceNumber as string

  await gotoReady(page, '/accounting/ar-invoices')
  const searchInput = page.getByPlaceholder('Search…')
  // Never typed the invoice number anywhere in this test — searching by the
  // TRANSACTION number alone still finds the invoice row. Auto-searches
  // ~400ms after typing stops — no Apply click needed.
  await fillStable(searchInput, transactionNumber)
  await expect(page.getByText(invoiceNumber, { exact: true })).toBeVisible({ timeout: 10_000 })
})

test("searching by customer name filters the list to that customer's invoices", async ({
  page,
}) => {
  // This screen previously had no way to filter by customer except arriving
  // via a link from Customer360 — this is the new, live customer search.
  const applicantName = `E2E AR Customer Search ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: {
      name: applicantName,
      customerType: 'individual',
      phone: '09170006688',
      creditLimit: 200000,
    },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  await gotoReady(page, '/accounting/ar-invoices')
  const customerSearchInput = page.getByPlaceholder('Search by name or phone…')
  const resultOption = page.getByText(applicantName, { exact: true })
  // fillStable only proves the value at the instant it's checked — this
  // page does its own async data-fetching on mount (the initial customer
  // list + invoice list), and a later hydration reconciliation can still
  // wipe the field after fillStable's own check passes (see fillStable's
  // doc comment in utils.ts). Retrying the fill together with waiting for
  // the debounced dropdown result — not just the fill alone — means a wipe
  // just triggers a clean re-fill instead of a hung click.
  await expect(async () => {
    await fillStable(customerSearchInput, applicantName)
    await expect(resultOption).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 15_000 })
  await resultOption.click()

  await expect(page.getByText(`Filtered to ${applicantName}`, { exact: false })).toBeVisible({
    timeout: 10_000,
  })
})

test("the New Invoice form's customer picker is a search box, not a full-list <select>", async ({
  page,
}) => {
  // Found live, 2026-08-09 — this picker used to be a plain <select>
  // fed by a full, unfiltered customer list. Rebuilt as a search box on
  // the same accounting-scoped endpoint as the list filter above, since
  // an Accountant (accounting:* only) doesn't hold the CRM permission
  // that full list required.
  const applicantName = `E2E New Invoice Customer ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: { name: applicantName, customerType: 'individual', phone: '09170006633' },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  await gotoReady(page, '/accounting/ar-invoices')
  await page.getByRole('button', { name: 'New Invoice' }).click()

  const dialog = page.locator('.max-w-xl')
  const customerInput = dialog.getByPlaceholder('Search by name or phone…')
  const resultOption = dialog.getByText(applicantName, { exact: true })
  await expect(async () => {
    await fillStable(customerInput, applicantName)
    await expect(resultOption).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 15_000 })
  await resultOption.click()

  // Selecting collapses the dropdown and shows the chosen name in the
  // input itself — proves customerId actually got set, not just typed text.
  await expect(customerInput).toHaveValue(applicantName)

  await dialog.getByLabel('Subtotal *').fill('1000')
  await dialog.getByRole('button', { name: 'Save' }).click()

  await expect(dialog).toBeHidden({ timeout: 10_000 })
  await expect(page.getByText(applicantName, { exact: false }).first()).toBeVisible()
})
