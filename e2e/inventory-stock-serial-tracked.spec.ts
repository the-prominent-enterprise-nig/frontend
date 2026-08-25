import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Covers the fix for a real bug: serial-tracked items (Washing Machine,
// Refrigerator, etc.) never get a StockBalance row, so the Stock Balance
// report — which previously only ever read StockBalance — silently showed
// nothing for them, in stock or not, even with hundreds of real in-stock
// serials seeded per branch. Checkout already counted real SerialNumber rows
// correctly; this admin view didn't.
test.describe('Inventory — serial-tracked item stock visibility', () => {
  test('Stock Balance page reports a serial-tracked item per warehouse instead of showing nothing', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/stock')

    const searchInput = page.getByPlaceholder('Search item name, SKU, or serial number…')
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
})
