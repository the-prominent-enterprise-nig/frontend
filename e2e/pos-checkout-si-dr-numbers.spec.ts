import { test, expect, type Page } from '@playwright/test'
import { gotoReady, loginAs, fillStable } from './utils'

// SI/CR/DR reference numbers on a POS sale — SI (Sales Invoice #) and DR
// (Delivery Receipt #) are new, optional, free-text, once per whole
// transaction on PosTransaction (not per payment/tender like the existing
// CR/referenceNumber, which is unchanged and covered elsewhere). Both are
// editable at checkout and shown read-only on the printed receipt and the
// transaction detail page.
//
// The suite's usual "Universal Remote Control"/"Refrigerator" cart fixtures
// were removed by a seed change that strips all fictional catalog items, and
// the real NIG catalog that replaced them is almost entirely serial-tracked
// with zero SerialNumber rows currently seeded — nothing sellable is
// guaranteed to exist. The first test below builds its own self-contained
// item + stock via API instead of depending on seed data.

const DEV_PASSWORD = 'dev-prominent-enterprise-2026'
const OWNER_EMAIL = 'technova.owner@test.com'
const CASHIER_EMAIL = 'technova.b1.cashier@test.com'

let createdCustomerId: string | undefined
let createdItemId: string | undefined

test.afterEach(async ({ page }) => {
  // Soft-deletes (sets deletedAt) — same tradeoff as
  // pos-transaction-detail-invoices.spec.ts: the transaction/invoice/JE it
  // produced is a permanent workflow record, never unwound.
  if (createdCustomerId) {
    await page.request.delete(`/api/crm/customers/${createdCustomerId}`)
    createdCustomerId = undefined
  }
  if (createdItemId) {
    await page.request.delete(`/api/inventory/items/${createdItemId}`)
    createdItemId = undefined
  }
})

async function ensureOpenSession(page: Page, branchId: string): Promise<string> {
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

/**
 * Creates a fresh non-serial item, pushes it through the item-governance
 * workflow (draft -> submit -> confirm-accounting -> approve, Scenario 16 —
 * otherwise it's invisible to a non-governance session), and stocks it at
 * the given branch via the adjustment workflow's own 3-step approval chain
 * (Scenario 19 Part 2 — an adjustment only posts to stock on the final
 * `approve`). Requires a session with governance/adjustment-approval
 * permissions (the default Business Owner storageState bypasses every
 * check here, same as `ensureItemStock` in utils.ts relies on).
 */
async function createStockedItem(
  page: Page,
  branchName: string,
  quantity: number
): Promise<{ id: string; name: string }> {
  const anyItemRes = await page.request.get('/api/inventory/items?limit=1')
  const anyItems = ((await anyItemRes.json()).data ?? []) as { baseUnit: { id: string } }[]
  const baseUnitId = anyItems[0].baseUnit.id

  const name = `E2E POS SI DR Item ${Date.now()}`
  const createRes = await page.request.post('/api/inventory/items', {
    data: {
      sku: `E2E-POS-SIDR-${Date.now()}`,
      name,
      baseUnitId,
      isSerialTracked: false,
      sellingPrice: 500,
    },
  })
  expect(createRes.ok()).toBeTruthy()
  const item = await createRes.json()

  await page.request.post(`/api/inventory/items/${item.id}/submit`)
  await page.request.post(`/api/inventory/items/${item.id}/confirm-accounting`, { data: {} })
  await page.request.post(`/api/inventory/items/${item.id}/approve`, { data: {} })

  const branchesRes = await page.request.get('/api/branches?limit=200')
  const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
  const branch = branches.find((b) => b.name === branchName)!

  const warehousesRes = await page.request.get('/api/inventory/warehouses?limit=200')
  const warehouses = ((await warehousesRes.json()).data ?? []) as {
    id: string
    branchId: string | null
  }[]
  const warehouse = warehouses.find((w) => w.branchId === branch.id)!

  const adjustRes = await page.request.post('/api/inventory/adjustments', {
    data: {
      warehouseId: warehouse.id,
      adjustmentDate: new Date().toISOString().slice(0, 10),
      reasonCode: 'found',
      notes: 'E2E SI/DR fixture stock',
      lines: [{ itemId: item.id, expectedQty: 0, actualQty: quantity }],
    },
  })
  expect(adjustRes.ok()).toBeTruthy()
  const adjustment = await adjustRes.json()
  for (const step of ['confirm', 'investigate', 'approve']) {
    const stepRes = await page.request.patch(`/api/inventory/adjustments/${adjustment.id}/${step}`)
    expect(stepRes.ok()).toBeTruthy()
  }

  return { id: item.id as string, name }
}

test('a transaction created with SI/DR numbers shows them on the transaction detail page', async ({
  page,
}) => {
  const branchesRes = await page.request.get('/api/branches?limit=200')
  const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
  const branchId = branches.find((b) => b.name === 'Bago')!.id

  const item = await createStockedItem(page, 'Bago', 5)
  createdItemId = item.id

  const applicantName = `E2E SI DR ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: { name: applicantName, customerType: 'individual', phone: '09170007777' },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  const sessionId = await ensureOpenSession(page, branchId)

  const siNumber = `SI-E2E-${Date.now()}`
  const drNumber = `DR-E2E-${Date.now()}`

  const txRes = await page.request.post('/api/pos/transactions', {
    data: {
      sessionId,
      customerId: customer.id,
      subtotal: 500,
      totalAmount: 500,
      currency: 'PHP',
      salesInvoiceNumber: siNumber,
      deliveryReceiptNumber: drNumber,
      lines: [{ itemId: item.id, itemName: item.name, quantity: 1, unitPrice: 500 }],
    },
  })
  expect(txRes.ok()).toBeTruthy()
  const created = await txRes.json()
  expect(created.salesInvoiceNumber).toBe(siNumber)
  expect(created.deliveryReceiptNumber).toBe(drNumber)

  await gotoReady(page, '/pos/transactions')
  const searchInput = page.getByPlaceholder('Search…')
  // The list column shows the Sales Invoice No. now; search matches it too.
  await fillStable(searchInput, siNumber)
  // Auto-searches ~400ms after typing stops — no Apply click needed.
  await page.getByText(siNumber, { exact: true }).click()

  // The SI number is the detail modal's heading now, not a labelled row.
  await expect(page.getByText(siNumber, { exact: true })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Delivery Receipt No.', { exact: true })).toBeVisible()
  await expect(page.getByText(drNumber, { exact: true })).toBeVisible()
})

// NOT currently run/verified — see the developer conversation this was
// written in. A full UI checkout needs the added item to also resolve a
// price under Price Use "WIP", and the only route found for that
// (POST /inventory/price-lists/:id/items) reverts the shared, seeded WIP
// price list to 'pending' as a side effect of upsertItems()
// (price-lists.service.ts's revertToPendingIfActive) — too invasive to run
// against the shared WIP list just for this fixture. Left here for whoever
// picks this up once either the seed catalog has real sellable stock again,
// or a non-invasive way to price a fresh item under WIP exists (e.g. a
// dedicated, separately-approved price list scoped to just this item).
test.describe('POS Checkout — SI/DR numbers end to end', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test.skip('cashier fills SI/DR at checkout, sees them on the receipt and on the transaction detail page', async ({
    page,
  }) => {
    await loginAs(page, OWNER_EMAIL, DEV_PASSWORD)
    const item = await createStockedItem(page, 'Bago', 5)
    createdItemId = item.id

    await page.context().clearCookies()
    await loginAs(page, CASHIER_EMAIL, DEV_PASSWORD)

    const branchesRes = await page.request.get('/api/branches?limit=200')
    const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
    const branchId = branches.find((b) => b.name === 'Bago')!.id
    await ensureOpenSession(page, branchId)

    await gotoReady(page, '/pos/checkout')

    const searchInput = page.getByPlaceholder('Search by name or serial')
    await expect(searchInput).toBeVisible({ timeout: 15_000 })
    await searchInput.fill(item.name)
    const itemCard = page
      .getByRole('button')
      .filter({ has: page.getByText(item.name, { exact: true }) })
    await expect(itemCard.first()).toBeVisible({ timeout: 10_000 })
    await itemCard.first().click()
    const cartRow = page.locator('tr', { hasText: item.name })
    await expect(cartRow).toBeVisible({ timeout: 10_000 })
    await page.getByLabel('Price Use').selectOption({ label: 'WIP' })
    await expect(cartRow.getByText(/₱[\d,]+\.\d{2}/)).toBeVisible({ timeout: 10_000 })

    const siNumber = `SI-E2E-${Date.now()}`
    const drNumber = `DR-E2E-${Date.now()}`
    await fillStable(page.getByLabel('Sales Invoice number'), siNumber)
    await fillStable(page.getByLabel('Delivery Receipt number'), drNumber)

    // The auto-added cash payment row starts at 0 — overpay generously so
    // the item's exact price (which can vary/change) never blocks
    // submission on an unmet balance; cash allows change due back.
    await fillStable(page.getByPlaceholder('0.00').first(), '100000')

    // Not clickStable — this submits a real sale, and retrying it on a
    // slow response would double-submit rather than just re-checking a
    // client-side render.
    await page.getByRole('button', { name: /Confirm Sale/ }).click()
    await expect(page.getByText('Sale Complete', { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Sales Invoice No.', { exact: true })).toBeVisible()
    await expect(page.getByText(siNumber, { exact: true })).toBeVisible()
    await expect(page.getByText('Delivery Receipt No.', { exact: true })).toBeVisible()
    await expect(page.getByText(drNumber, { exact: true })).toBeVisible()

    await gotoReady(page, '/pos/transactions')
    const txSearchInput = page.getByPlaceholder('Search…')
    // The list column shows the Sales Invoice No. now; search matches it too.
    await fillStable(txSearchInput, siNumber)
    await page.getByText(siNumber, { exact: true }).click()

    // The SI number is the detail modal's heading now, not a labelled row.
    await expect(page.getByText(siNumber, { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Delivery Receipt No.', { exact: true })).toBeVisible()
    await expect(page.getByText(drNumber, { exact: true })).toBeVisible()
  })
})
