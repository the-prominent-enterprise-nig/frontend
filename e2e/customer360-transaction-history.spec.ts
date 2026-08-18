import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

let createdCustomerId: string | undefined

test.afterEach(async ({ page }) => {
  if (createdCustomerId) {
    await page.request.delete(`/api/crm/customers/${createdCustomerId}`)
    createdCustomerId = undefined
  }
})

// Scenario 29 item 2 (CRM-01) — Customer360's "Installment Plans" section
// only ever covered financed purchases; a customer's cash/full-payment
// sales had no equivalent anywhere on the profile. This spec covers the
// new "Transaction History" section against a plain (non-installment) sale
// — the exact gap this closing-gap item targeted. Backend correctness of
// the underlying endpoint (branch scoping, 20-row cap, ordering) is
// pre-existing and already covered elsewhere (transactions.service.ts's
// getCustomerHistory is proven via the POS checkout panel that already
// consumes it) — this spec sticks to the new UI surface only.

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

test('Customer360 Transaction History shows a plain cash sale (not just installment plans)', async ({
  page,
}) => {
  const customerRes = await page.request.post('/api/crm/customers', {
    data: {
      name: `E2E Transaction History ${Date.now()}`,
      customerType: 'individual',
      phone: '09170006611',
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
      subtotal: item.sellingPrice,
      totalAmount: item.sellingPrice,
      currency: 'PHP',
      lines: [{ itemId: item.id, itemName: item.name, quantity: 1, unitPrice: item.sellingPrice }],
    },
  })
  expect(txRes.ok()).toBeTruthy()
  const created = await txRes.json()
  expect(created.status).toBe('completed')

  await gotoReady(page, `/crm/customers/${customer.id}`)

  await expect(page.getByText('Transaction History', { exact: true })).toBeVisible({
    timeout: 10_000,
  })
  // Not covered by "Installment Plans" at all — this customer has no
  // financed purchases, so this section is the only place the sale shows.
  await expect(page.getByText(created.transactionNumber, { exact: false })).toBeVisible()
  await expect(page.getByText('sale', { exact: true })).toBeVisible()
  await expect(page.getByText('completed', { exact: true })).toBeVisible()
})

test('Customer360 Transaction History shows an empty state for a customer with no purchases', async ({
  page,
}) => {
  const customerRes = await page.request.post('/api/crm/customers', {
    data: {
      name: `E2E No Transactions ${Date.now()}`,
      customerType: 'individual',
      phone: '09170006622',
    },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  await gotoReady(page, `/crm/customers/${customer.id}`)

  await expect(page.getByText('Transaction History', { exact: true })).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText('No transactions for this customer.', { exact: true })).toBeVisible()
})
