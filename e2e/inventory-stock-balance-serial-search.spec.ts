import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Scenario 60 Part 4 — client wording: "Have an option to view all movement
// of transfers PER SERIAL. Make it intuitive, and should be easily findable
// under the stock balance." The item-rollup search on this page stays
// brand/model/category only (a serial belongs to one unit, not the rolled-up
// quantity a row reports), but a serial typed into that same box now also
// resolves — independently — to a "View movement history" banner that opens
// straight into that one serial's own timeline, skipping the previous
// path of opening the item, landing on Stock, and searching again there.
//
// Uses a real serial already sold in the dev DB during manual testing
// (SN-2819281, SHARP 4TC50HJ6000X) rather than a seeded one — the seed only
// ever bulk-registers in-stock serials, and this also doubles as a real
// regression check that a SOLD serial is still reachable this way.
test.describe('Inventory — Stock Balance, jump to a serial’s movement history', () => {
  test('typing a serial number surfaces a banner that opens straight into its movements', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/stock')

    const searchInput = page.getByPlaceholder('Search brand, model, or category…')
    await expect(searchInput).toBeVisible({ timeout: 15_000 })

    const banner = page.getByRole('button', { name: /View movement history/ })
    await expect(async () => {
      await fillStable(searchInput, 'SN-2819281')
      await expect(banner).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 30_000 })

    await expect(banner).toContainText('SN-2819281')
    await expect(banner).toContainText('SHARP')

    await banner.click()

    const drawer = page.getByRole('dialog', { name: 'Item Details' })
    await expect(drawer).toBeVisible({ timeout: 10_000 })

    // Straight to the serial's own timeline — no tab nav, no Stock tab
    // detour, no second search.
    await expect(drawer.getByRole('navigation', { name: 'Item 360 tabs' })).toHaveCount(0)
    await expect(drawer.getByRole('button', { name: 'Back to Stock' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(drawer.getByText('SN-2819281', { exact: true })).toBeVisible()
    // The real sale that produced this data (Scenario 60 manual testing) —
    // proves the movement entry actually rendered, not just the header.
    await expect(drawer.getByText(/Sold to/)).toBeVisible()
  })
})
