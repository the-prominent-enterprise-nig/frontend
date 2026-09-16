import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Covers the fix for a real bug: serial-tracked items (Washing Machine,
// Refrigerator, etc.) never get a StockBalance row, so the Stock Balance
// report — which previously only ever read StockBalance — silently showed
// nothing for them, in stock or not, even with hundreds of real in-stock
// serials seeded per branch. Checkout already counted real SerialNumber rows
// correctly; this admin view didn't.
//
// Scenario 50 — the report now rolls every location into ONE row per item, so
// this no longer asserts a row per warehouse. The behaviour it actually
// guards is unchanged and still the point: a serial-tracked item must appear
// at all, carrying a real count derived from SerialNumber rows rather than
// 0/blank. The per-warehouse split is covered by the backend spec
// (backend/test/stock-balance-rollup.e2e-spec.ts) and shown in the Item 360
// drawer.
test.describe('Inventory — serial-tracked item stock visibility', () => {
  test('Stock Balance page reports serial-tracked items, rolled up across warehouses', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/stock')

    const searchInput = page.getByPlaceholder('Search brand, model, or category…')
    await expect(searchInput).toBeVisible({ timeout: 15_000 })

    // A later hydration reconciliation on this page can silently wipe the
    // search value after fillStable's own check has already passed (the same
    // race fillAllStable's docstring describes) — retry the fill itself until
    // the filtered rows actually show up, rather than trusting a single fill
    // to survive. Same workaround as inventory-item-360-stock-tabs.spec.ts.
    const rows = page.locator('tbody tr', { hasText: 'Washing Machine' })
    await expect(async () => {
      await fillStable(searchInput, 'Washing Machine')
      await expect(rows.first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 30_000 })

    // Previously: "No stock records found" — StockBalance never gets a row
    // for a serial-tracked item, so the report had nothing to query.
    await expect(page.getByText('No stock records found')).toHaveCount(0)

    // The seed carries many washing-machine models, so this is not a
    // single-row assertion — what the roll-up guarantees is that no model is
    // listed more than once, however many branches hold it.
    const titles = (await rows.locator('td:first-child p:first-child').allTextContents()).map((t) =>
      t.trim()
    )
    expect(titles.filter((t, i) => titles.indexOf(t) !== i)).toEqual([])

    // A real count derived from SerialNumber rows, not 0/blank — the
    // original point of this spec, restated for the summed row.
    const onHand = await rows.first().locator('td').nth(1).innerText()
    expect(Number(onHand.replace(/,/g, ''))).toBeGreaterThan(0)
  })
})
