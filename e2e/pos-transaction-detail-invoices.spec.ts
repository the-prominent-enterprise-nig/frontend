import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

let createdCustomerId: string | undefined

test.afterEach(async ({ page }) => {
  // Soft-deletes (sets deletedAt) — drops out of the Customers list
  // immediately without needing to unwind the transaction/invoice/JE it
  // produced, consistent with how this codebase already treats those as
  // permanent workflow records elsewhere (e.g.
  // pos-installment-financing.e2e-spec.ts).
  if (createdCustomerId) {
    await page.request.delete(`/api/crm/customers/${createdCustomerId}`)
    createdCustomerId = undefined
  }
})

// Scenario 23 Gap 1 — the POS transaction detail screen now surfaces the
// invoice(s) a transaction produced, individually, with live status. Backend
// correctness (invoices array shape, charge vs installment, per-schedule
// grouping) is covered by backend/test/pos-credit-enforcement.e2e-spec.ts
// (CE-04) and pos-installment-financing.e2e-spec.ts (IF-03/IF-13) — this
// spec sticks to the UI surface: does the Invoices section actually render
// on the transaction detail modal, matching this codebase's existing split
// (see pos-checkout-installment-credit-application.spec.ts).
//
// Setup goes through the API directly rather than the full checkout UI —
// the default storageState (business-owner.json) holds
// pos:transaction:override, so a charge sale self-approves and completes
// immediately (TransactionsController.create's canSelfApprove path), no
// need to drive submit/sign/approve across roles just to get a completed
// transaction to inspect.

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

test('transaction detail shows the charge invoice with its own number and live status', async ({
  page,
}) => {
  const applicantName = `E2E TX Detail ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: {
      name: applicantName,
      customerType: 'individual',
      phone: '09170005555',
      creditLimit: 200000,
    },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  const branchesRes = await page.request.get('/api/branches?limit=200')
  const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
  const branchId = branches.find((b) => b.name === 'Bago')!.id
  const sessionId = await ensureOpenSession(page, branchId)

  // Same item pos-checkout-installment-credit-application.spec.ts and
  // pos-checkout-promissory-note.spec.ts already rely on being in stock at
  // every branch, rather than an arbitrary first result that might have
  // zero stock at this branch's warehouse.
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

  await gotoReady(page, '/pos/transactions')
  const searchInput = page.getByPlaceholder('Search…')
  await fillStable(searchInput, transactionNumber)
  // Auto-searches ~400ms after typing stops — no Apply click needed.
  await page.getByText(transactionNumber, { exact: true }).click()

  await expect(page.getByText('Invoices', { exact: true })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Charge invoice')).toBeVisible()
  await expect(page.getByText(/^CHG-/)).toBeVisible()
  await expect(page.getByText('Due', { exact: true })).toBeVisible()
})

test('searching by the charge invoice number finds the same transaction (Scenario 23 Gap 3)', async ({
  page,
}) => {
  const applicantName = `E2E TX Detail ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: {
      name: applicantName,
      customerType: 'individual',
      phone: '09170005566',
      creditLimit: 200000,
    },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  const branchesRes = await page.request.get('/api/branches?limit=200')
  const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
  const branchId = branches.find((b) => b.name === 'Bago')!.id
  const sessionId = await ensureOpenSession(page, branchId)

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
  const invoiceNumber = created.invoices[0].invoiceNumber as string
  const transactionNumber = created.transactionNumber as string

  await gotoReady(page, '/pos/transactions')
  const searchInput = page.getByPlaceholder('Search…')
  // Searching by the INVOICE number (never typed the transaction number
  // anywhere in this test) still finds the row, and shows the real
  // transaction number on it — proving the unified search actually
  // resolved through the invoice, not just filtered on itself.
  await fillStable(searchInput, invoiceNumber)
  // Auto-searches ~400ms after typing stops — no Apply click needed.
  await expect(page.getByText(transactionNumber, { exact: true })).toBeVisible({
    timeout: 10_000,
  })
})
