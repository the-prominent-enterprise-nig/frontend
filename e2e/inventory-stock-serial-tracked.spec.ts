import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Covers the fix for a real bug: serial-tracked items (Washing Machine,
// Refrigerator, etc.) never get a StockBalance row, so both the Stock
// Balance report and the Item Master Variants modal — which previously only
// ever read StockBalance — silently showed nothing for them, in stock or
// not, even with hundreds of real in-stock serials seeded per branch (see
// prisma/seed.ts "Variant item serials"). Checkout already counted real
// SerialNumber rows correctly; these two admin views didn't.
test.describe('Inventory — serial-tracked item stock visibility', () => {
  test('Stock Balance page reports a serial-tracked item per warehouse instead of showing nothing', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/stock')

    const searchInput = page.getByPlaceholder('Search item name or SKU…')
    await expect(searchInput).toBeVisible({ timeout: 15_000 })
    await fillStable(searchInput, 'Washing Machine')

    // Previously: "No stock records found" — StockBalance never gets a row
    // for a serial-tracked item, so the report had nothing to query.
    await expect(page.getByText('No stock records found')).toHaveCount(0, {
      timeout: 10_000,
    })

    const rows = page.locator('tbody tr', { hasText: 'Washing Machine' })
    await expect(rows.first()).toBeVisible({ timeout: 10_000 })
    // Seeded with 200 in-stock serials at every branch (prisma/seed.ts) —
    // at least one branch's row should show that real count, not 0/blank.
    await expect(rows.first()).toContainText('200')
    await expect(rows.first().getByText('In Stock', { exact: true })).toBeVisible()
  })

  test("Item Master Variants modal shows a real shared stock total for a serial-tracked item's variants", async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/items')

    const searchInput = page.getByPlaceholder('Search by name or SKU…')
    await expect(searchInput).toBeVisible({ timeout: 15_000 })
    await fillStable(searchInput, 'Washing Machine')

    const row = page.locator('tbody tr', { hasText: 'Washing Machine' }).first()
    await expect(row).toBeVisible({ timeout: 10_000 })

    // The Variants button is icon-only (no accessible name) — it's the
    // row's one action button styled text-blue-600 (View/Edit/Delete are
    // text-zinc-400/text-red-600).
    await row.locator('button.text-blue-600').click()

    await expect(page.getByRole('heading', { name: 'Item Variants' })).toBeVisible({
      timeout: 10_000,
    })

    // Washing Machine is seeded with 3 capacity variants (7kg/8kg/10kg),
    // none split by stock (SerialNumber carries no variantId) — each must
    // show the same real total, labeled as shared rather than blank/zero.
    await expect(page.getByText('shared across variants').first()).toBeVisible({
      timeout: 10_000,
    })
    const availLabels = page.getByText(/\d+\s*avail/)
    await expect(availLabels.first()).toBeVisible()
    const count = await availLabels.count()
    expect(count).toBeGreaterThanOrEqual(3)

    await page.getByRole('button', { name: 'Close' }).click()
  })
})
