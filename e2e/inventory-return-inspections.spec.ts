import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 18 (Returns, Exchanges & Disposition) Part 1 — Quarantine +
// inspection step. Setup uses page.request (shares the already-
// authenticated browser session's auth cookie via the Next.js API proxy) to
// get a real void request into pending_inspection — orchestrating a full
// checkout + void through the UI isn't needed to exercise the actual
// feature under test: the new Return Inspections queue and its inspect
// action. Self-cleaning: the request is rejected via API at the end so it
// doesn't linger in the manager approval queue.
test.describe('Inventory — Return Inspections (Scenario 18)', () => {
  test('a pending void request can be inspected from the queue, and clears once submitted', async ({
    page,
  }) => {
    const terminalsRes = await page.request.get('/api/pos/terminals')
    expect(terminalsRes.ok()).toBe(true)
    const terminalsBody = await terminalsRes.json()
    const terminals = Array.isArray(terminalsBody) ? terminalsBody : terminalsBody.data
    const terminal = terminals.find((t: { terminalCode: string }) => t.terminalCode === 'TN-B1-01')
    expect(terminal, 'seeded Manila terminal TN-B1-01 must exist').toBeDefined()

    // Reuse an already-open session on this terminal if one exists (shared
    // dev DB — other specs/manual testing may have left one open); only
    // open a new one if none does.
    const openSessionsRes = await page.request.get(
      `/api/pos/sessions?terminalId=${terminal.id}&status=open`
    )
    expect(openSessionsRes.ok()).toBe(true)
    const openSessionsBody = await openSessionsRes.json()
    const openSessions = Array.isArray(openSessionsBody) ? openSessionsBody : openSessionsBody.data
    let sessionId: string
    if (openSessions.length > 0) {
      sessionId = openSessions[0].id
    } else {
      const openRes = await page.request.post('/api/pos/sessions/open', {
        data: { terminalId: terminal.id, openingCash: 1000 },
      })
      expect(openRes.ok()).toBe(true)
      sessionId = (await openRes.json()).id
    }

    // Any active, non-variant, in-stock item — lookupItems only ever
    // returns items with a StockBalance row, which serial-tracked items
    // never carry, so this is guaranteed non-serial.
    const itemsRes = await page.request.get(
      `/api/pos/transactions/items/lookup?branchId=${terminal.branchId}`
    )
    expect(itemsRes.ok()).toBe(true)
    const items = await itemsRes.json()
    const saleItem = items.find(
      (i: { hasVariants: boolean; availableQty: number }) => !i.hasVariants && i.availableQty > 0
    )
    expect(saleItem, 'at least one sellable non-variant item must exist').toBeDefined()

    // A customer is required on every non-refund sale.
    const customersRes = await page.request.get('/api/crm/customers?limit=1')
    expect(customersRes.ok()).toBe(true)
    const customersBody = await customersRes.json()
    const customers = Array.isArray(customersBody) ? customersBody : customersBody.data
    expect(customers.length, 'at least one seeded CRM customer must exist').toBeGreaterThan(0)
    const customerId = customers[0].id

    const saleRes = await page.request.post('/api/pos/transactions', {
      data: {
        sessionId,
        customerId,
        subtotal: saleItem.sellingPrice,
        totalAmount: saleItem.sellingPrice,
        currency: 'PHP',
        lines: [
          {
            itemId: saleItem.id,
            itemName: saleItem.name,
            quantity: 1,
            unitPrice: saleItem.sellingPrice,
          },
        ],
      },
    })
    expect(saleRes.ok()).toBe(true)
    const sale = await saleRes.json()

    const voidRes = await page.request.post(`/api/pos/transactions/${sale.id}/void-request`, {
      data: { reason: 'E2E Scenario 18 — inspection queue test' },
    })
    expect(voidRes.ok()).toBe(true)
    const voidRequest = await voidRes.json()
    expect(voidRequest.status).toBe('pending_inspection')

    await gotoReady(page, '/inventory/return-inspections')
    await expect(page.getByRole('heading', { name: 'Return Inspections' })).toBeVisible({
      timeout: 15_000,
    })

    const row = page.locator('tbody tr', { hasText: sale.transactionNumber })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.getByRole('button', { name: 'Inspect' }).click()

    await expect(
      page.getByRole('heading', { name: 'Inspect void Request', exact: false })
    ).toBeVisible({ timeout: 10_000 })
    await page
      .getByPlaceholder('Unit powers on, minor scuff on casing, no missing accessories…')
      .fill('Unit received, condition matches original sale, no visible damage.')
    await page.getByRole('button', { name: 'Submit Inspection' }).click()

    // The request leaves pending_inspection on submit, so it drops out of
    // this queue entirely (this page never shows pending/approved rows).
    // Not asserting the queue is fully empty afterward — this is a shared
    // dev DB and other pending-inspection requests may legitimately exist.
    await expect(row).toHaveCount(0, { timeout: 15_000 })

    // Cleanup: reject via API so the now-inspected request doesn't linger
    // in the manager approval queue (Refund Approvals) after this run.
    const rejectRes = await page.request.post(
      `/api/pos/return-refund-requests/${voidRequest.id}/reject`,
      { data: { reviewNotes: 'E2E cleanup — inspection queue test' } }
    )
    expect(rejectRes.ok()).toBe(true)
  })
})
