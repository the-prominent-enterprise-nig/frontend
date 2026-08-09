import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

let createdCustomerId: string | undefined

test.afterEach(async ({ page }) => {
  // Soft-deletes (sets deletedAt) — drops out of the Customers list
  // immediately. The credit application/transaction/invoices it produced
  // stay, consistent with this codebase's existing "permanent workflow
  // record" tradeoff for those (see pos-installment-financing.e2e-spec.ts).
  if (createdCustomerId) {
    await page.request.delete(`/api/crm/customers/${createdCustomerId}`)
    createdCustomerId = undefined
  }
})

// Scenario 23 Gap 2 — Customer360's "Installment Plans" section now shows
// each due-date invoice's own number, the product/brand being financed, and
// the rebate (7.5% of the monthly installment). Backend correctness
// (posTransactionLines/installmentAccount shape, including the Gap-5
// multi-item-per-schedule case) is covered by
// backend/test/pos-installment-financing.e2e-spec.ts (IF-03/IF-12) — this
// spec sticks to the UI surface, same split as
// pos-transaction-detail-invoices.spec.ts.
//
// Setup goes through the API directly — the default storageState
// (business-owner.json) holds pos:transaction:override, so an installment
// sale self-approves and completes immediately, no need to drive
// submit/sign/approve across roles just to get a schedule to inspect.

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

test('Customer360 shows invoice number, product/brand, and rebate for an installment plan', async ({
  page,
}) => {
  const applicantName = `E2E Installment Detail ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: {
      name: applicantName,
      customerType: 'individual',
      phone: '09170005588',
      creditLimit: 200000,
      coMakers: [
        {
          name: 'E2E Installment Detail Co-Maker',
          relationship: 'Spouse',
          contactNumber: '09171115588',
        },
      ],
    },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  const branchesRes = await page.request.get('/api/branches?limit=200')
  const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
  const branchId = branches.find((b) => b.name === 'Bago')!.id
  const sessionId = await ensureOpenSession(page, branchId)

  const termsRes = await page.request.get('/api/pos/financing-terms')
  const termsBody = await termsRes.json()
  const terms = (termsBody.data ?? termsBody) as { id: string; termMonths: number }[]
  // Seeded tenant-wide term (3/6/9/12 months) — pinned rather than terms[0]
  // so the "3 due-date invoices" assertion below is deterministic.
  const term = terms.find((t) => t.termMonths === 3) ?? terms[0]

  const itemsRes = await page.request.get('/api/inventory/items', {
    params: { search: 'Universal Remote Control', limit: '1' },
  })
  const items = ((await itemsRes.json()).data ?? []) as {
    id: string
    name: string
    sellingPrice: number
  }[]
  const item = items[0]

  // Scenario 17 Part 6 — every installment sale requires an approved,
  // unconsumed CreditApplication, regardless of who's submitting it.
  const appRes = await page.request.post('/api/credit/applications', {
    data: {
      branchId,
      applicantCustomerId: customer.id,
      coMakerId: customer.coMakers[0].id,
      requestedAmount: item.sellingPrice * 2,
    },
  })
  const application = await appRes.json()
  const uploadRes = await page.request.post('/api/files/upload', {
    multipart: {
      file: { name: 'id.txt', mimeType: 'text/plain', buffer: Buffer.from('fake id') },
    },
  })
  const file = await uploadRes.json()
  await page.request.post(`/api/credit/applications/${application.id}/documents`, {
    data: { fileId: file.id, documentType: 'applicant_id' },
  })
  await page.request.patch(`/api/credit/applications/${application.id}/submit`)
  await page.request.post(`/api/credit/applications/${application.id}/investigation/start`)
  await page.request.post(`/api/credit/applications/${application.id}/investigation`, {
    data: { affordabilityOutcome: 'recommend_approve', notes: 'E2E fixture' },
  })
  await page.request.patch(`/api/credit/applications/${application.id}/approve`)

  // Two lines sharing the same term (mirrors
  // pos-installment-financing.e2e-spec.ts's IF-12) — same item reused
  // twice, since what's under test is the multi-line breakdown UI, not
  // needing two distinct catalog products.
  const cartSubtotal = item.sellingPrice * 2
  const txRes = await page.request.post('/api/pos/transactions', {
    data: {
      sessionId,
      customerId: customer.id,
      invoiceType: 'installment',
      financingTermId: term.id,
      creditApplicationId: application.id,
      downPayment: 0,
      subtotal: cartSubtotal,
      totalAmount: cartSubtotal,
      currency: 'PHP',
      lines: [
        { itemId: item.id, itemName: item.name, quantity: 1, unitPrice: item.sellingPrice },
        { itemId: item.id, itemName: item.name, quantity: 1, unitPrice: item.sellingPrice },
      ],
    },
  })
  expect(txRes.ok()).toBeTruthy()
  const created = await txRes.json()
  expect(created.status).toBe('completed')

  await gotoReady(page, `/crm/customers/${customer.id}`)

  await expect(page.getByText('Installment Plans', { exact: true })).toBeVisible({
    timeout: 10_000,
  })
  // Collapsed summary row (developer-requested redesign, 2026-08-09): shows
  // the product and term months, not the full invoice/rebate breakdown —
  // that lives behind a click, matching the POS transaction detail modal
  // pattern.
  await expect(page.getByText(item.name, { exact: false }).first()).toBeVisible()
  await expect(page.getByText('3 months', { exact: false })).toBeVisible()
  await expect(page.getByText(/^INST-/)).toHaveCount(0)

  await page.getByText(item.name, { exact: false }).first().click()

  // Full breakdown now visible inside the detail modal.
  await expect(page.getByText(/^INST-/)).toHaveCount(3)
  await expect(page.getByText('Rebate', { exact: true })).toBeVisible()

  // Developer-requested (2026-08-09): this schedule combines 2 lines (same
  // item, same term) — the "Items in this plan" list must show BOTH, each
  // with its own price, not just the first one hidden behind "+1 more" in
  // the header.
  await expect(page.getByText('Items in this plan', { exact: true })).toBeVisible()
  const itemRows = page.getByTestId('installment-plan-items').locator('li')
  await expect(itemRows).toHaveCount(2)
  await expect(itemRows.first()).toContainText(item.name)
  await expect(itemRows.first()).toContainText(Number(item.sellingPrice).toFixed(2))
})

test('the profile\'s "View AR Ledger" link goes straight to that customer\'s filtered invoices', async ({
  page,
}) => {
  // Developer-requested (2026-08-09): previously the only path to a
  // customer's AR invoices was buried inside an Installment Plan row's
  // modal, which doesn't exist for a charge-only customer. This link on
  // the main profile page must work regardless of purchase history — no
  // installment sale, no transaction, nothing set up here at all.
  const applicantName = `E2E AR Ledger Link ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: { name: applicantName, customerType: 'individual', phone: '09170005599' },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  await gotoReady(page, `/crm/customers/${customer.id}`)
  await page.getByRole('link', { name: 'View AR Ledger' }).click()

  await expect(page).toHaveURL(new RegExp(`/accounting/ar-invoices\\?customerId=${customer.id}`))
  await expect(page.getByText(`Filtered to ${applicantName}`, { exact: false })).toBeVisible({
    timeout: 10_000,
  })
})
