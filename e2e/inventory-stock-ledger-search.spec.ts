import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Scenario 50 — Stock Ledger's search box and Source column (Gap 4), later
 * widened to cover item model and stock transfer (ST) number, and with
 * Unit Cost / Value / Customer / Accounting / Notes removed from the table.
 *
 * The ledger previously had no search at all, and its rows carried no
 * receipt provenance: `StockLedger.serialNumberId` / `goodsReceiptLineId`
 * are soft FKs with no Prisma relation on that table, so neither could be
 * reached through a nested `where` or an `include`. Both are resolved by
 * batched lookup, and search matches the ids up front and ORs them in —
 * which means it searches the whole ledger, not the page on screen.
 * `referenceId` (how a transfer-sourced entry is linked) is the same story:
 * it holds the StockTransfer's own id, not its human-readable number, so ST
 * search resolves matching numbers to ids the same way. Item model, by
 * contrast, is a real relation (`itemId`) — no id-resolution round trip
 * needed there, just a nested `item: { modelNumber: {...} }` clause.
 *
 * Seeds its own receipt so the assertion is about real data rather than
 * whatever the seed happens to hold.
 */
test.describe('Inventory — Stock Ledger search and provenance', () => {
  test('finds a movement by its receiving report and shows where it came from', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/stock?tab=ledger')

    // ── Seed one receipt, so there is a known RR/PO to search for ─────────
    const warehouses = await (
      await page.request.get('/api/inventory/warehouses?standaloneOnly=true&limit=1&status=active')
    ).json()
    const items = await (await page.request.get('/api/inventory/items?limit=50')).json()
    const warehouseId = warehouses.data?.[0]?.id
    // A serial-tracked line needs serialNumbers; pick a plain stock item.
    const itemId = (items.data ?? []).find(
      (i: { isSerialTracked?: boolean; isService?: boolean }) => !i.isSerialTracked && !i.isService
    )?.id
    expect(warehouseId, 'a standalone warehouse must exist').toBeTruthy()
    expect(itemId, 'a non-serial-tracked item must exist').toBeTruthy()

    const suppliers = await (
      await page.request.get('/api/suppliers?search=E2E-RRPO&limit=1')
    ).json()
    let supplierId = suppliers.data?.[0]?.id
    if (!supplierId) {
      const made = await (
        await page.request.post('/api/suppliers', {
          data: {
            code: 'E2E-RRPO',
            name: 'E2E RR/PO Reference Supplier',
            paymentTerms: 'Net 30',
            currency: 'PHP',
          },
        })
      ).json()
      supplierId = made.id ?? made.data?.id
    }

    const poNumber = `E2E-LEDGER-PO-${Date.now()}`
    const created = await page.request.post('/api/inventory/stock/receive', {
      data: {
        warehouseId,
        supplierId,
        applicationType: 'new_stock',
        deliveryReceiptNumber: `E2E-LEDGER-DR-${Date.now()}`,
        purchaseOrderNumber: poNumber,
        lines: [{ itemId, quantityReceived: 1, unitCost: 100 }],
      },
    })
    expect(created.ok(), `receive failed: ${await created.text()}`).toBeTruthy()
    const receiptCode = (await created.json()).code
    expect(receiptCode).toBeTruthy()

    // ── The search box finds it ───────────────────────────────────────────
    await gotoReady(page, '/inventory/stock?tab=ledger')
    await expect(page.getByRole('columnheader', { name: 'Source' })).toBeVisible({
      timeout: 30_000,
    })

    const searchBox = page.getByPlaceholder('Search unit, model, RR, ST, SI, or DR no.…')
    await expect(searchBox).toBeVisible()
    await searchBox.fill(receiptCode)

    // The list keeps the previous page while refetching, so settle first.
    const rows = page.locator('tbody tr')
    await expect.poll(async () => rows.count(), { timeout: 20_000 }).toBeGreaterThan(0)
    await expect
      .poll(async () => (await rows.allInnerTexts()).every((t) => t.includes(receiptCode)), {
        timeout: 20_000,
      })
      .toBe(true)

    // ── …and the Source column carries the provenance ─────────────────────
    const first = rows.first()
    await expect(first).toContainText(receiptCode)
    await expect(first).toContainText(`PO ${poNumber}`)
    await expect(first).toContainText('E2E RR/PO Reference Supplier')

    // A search that matches nothing returns nothing, rather than everything.
    await searchBox.fill('NOSUCHREFERENCE-ZZZ')
    await expect.poll(async () => rows.count(), { timeout: 20_000 }).toBe(0)
  })

  test('the removed columns are gone', async ({ page }) => {
    await gotoReady(page, '/inventory/stock?tab=ledger')
    await expect(page.getByRole('columnheader', { name: 'Source' })).toBeVisible({
      timeout: 30_000,
    })
    for (const name of ['Unit Cost', 'Value', 'Customer', 'Accounting', 'Notes']) {
      await expect(page.getByRole('columnheader', { name, exact: true })).toHaveCount(0)
    }
  })

  test('finds a movement by item model, and by stock transfer number', async ({ page }) => {
    await gotoReady(page, '/inventory/stock?tab=ledger')
    const searchBox = page.getByPlaceholder('Search unit, model, RR, ST, SI, or DR no.…')
    await expect(searchBox).toBeVisible({ timeout: 30_000 })
    const rows = page.locator('tbody tr')

    // Model: scan a real window of the ledger for one entry whose item has a
    // model number set (not every item does — generic parts/consumables
    // often don't), rather than assuming the single most-recent entry does.
    await expect.poll(async () => rows.count(), { timeout: 20_000 }).toBeGreaterThan(0)
    const windowRes = await page.request.get('/api/inventory/stock/ledger?limit=200')
    const windowEntries = (await windowRes.json()).data ?? []
    const distinctItemIds = [
      ...new Set(windowEntries.map((e: { item: { id: string } }) => e.item.id)),
    ] as string[]
    let modelItemId: string | undefined
    let model: string | undefined
    for (const id of distinctItemIds) {
      const detail = await (await page.request.get(`/api/inventory/items/${id}`)).json()
      if (detail.modelNumber) {
        modelItemId = id
        model = detail.modelNumber
        break
      }
    }
    test.skip(!model, "no item with a model number appears in the ledger's recent window")

    await searchBox.fill(model!)
    await expect
      .poll(
        async () => {
          const res = await page.request.get(
            `/api/inventory/stock/ledger?limit=200&search=${encodeURIComponent(model!)}`
          )
          const body = await res.json()
          return (
            body.total > 0 &&
            (body.data ?? []).every((e: { item: { id: string } }) => e.item.id === modelItemId)
          )
        },
        { timeout: 20_000 }
      )
      .toBe(true)

    // Stock transfer number: covered directly against the API — driving the
    // UI to create a full accept→dispatch→receive lifecycle purely to prove
    // a search match belongs in the dispatch spec's own coverage, not here.
    const transferRes = await page.request.get('/api/inventory/transfers?limit=1&status=received')
    const transfer = (await transferRes.json()).data?.[0]
    test.skip(!transfer, 'no received transfer exists yet to search for')

    const stRes = await page.request.get(
      `/api/inventory/stock/ledger?limit=50&search=${encodeURIComponent(transfer.transferNumber)}`
    )
    const stBody = await stRes.json()
    expect(stBody.total).toBeGreaterThan(0)
    expect(
      (stBody.data ?? []).every((e: { transactionType: string }) =>
        ['transfer_in', 'transfer_out'].includes(e.transactionType)
      )
    ).toBe(true)
  })
})
