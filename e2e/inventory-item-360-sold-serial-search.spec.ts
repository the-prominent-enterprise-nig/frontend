import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Scenario 60 Part 4 — client report: a sold serial couldn't be searched
// for at all in the Stock tab, so there was no way to look up its movement
// history once it left the shelf. StockTab.tsx deliberately excluded
// sold/scrapped/pulled_out serials from its per-location search (a sold unit
// isn't "at" any location any more) — this fixed the search itself, not the
// per-location breakdown, by adding a separate "Sold / removed" match list
// (shown above the per-location breakdown, not below — a search is most
// often looking for exactly this) that still opens the same movement
// drill-down.
//
// Uses a real serial already sold in the dev DB (SN-2819281, SHARP
// 4TC50HJ6000X, sold via a real POS checkout during manual testing) rather
// than a seeded fixture — the seed only ever bulk-registers in-stock
// serials, so there is no sold one to rely on already existing without
// driving a full checkout flow inside this spec.
test.describe('Inventory — Item 360 drawer, searching a sold serial', () => {
  test('a sold serial is findable by search and opens its movement history', async ({ page }) => {
    const itemsRes = await page.request.get(
      '/api/inventory/items?search=SHARP 4TC50HJ6000X&limit=1'
    )
    const items = ((await itemsRes.json()).data ?? []) as { id: string; name: string }[]
    expect(items.length).toBeGreaterThan(0)
    const item = items[0]

    await gotoReady(page, '/inventory/stock')

    const searchInput = page.getByPlaceholder('Search brand, model, or category…')
    await expect(searchInput).toBeVisible({ timeout: 15_000 })
    const row = page.getByRole('row').filter({ hasText: item.name }).first()
    await expect(async () => {
      await fillStable(searchInput, item.name)
      await expect(row).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 30_000 })
    await row.click()

    const drawer = page.getByRole('dialog', { name: 'Item Details' })
    await expect(drawer.getByRole('navigation', { name: 'Item 360 tabs' })).toBeVisible({
      timeout: 10_000,
    })

    const serialSearch = drawer.getByPlaceholder('Search serial, all locations…')
    await expect(serialSearch).toBeVisible({ timeout: 10_000 })
    await fillStable(serialSearch, 'SN-2819281')

    // Not nested under any per-location row — it's no longer physically at
    // one — but it does show, under the dedicated sold/removed list (above
    // the location breakdown), and the "no matches" empty state must not
    // fire. The explicit "N match(es) found" hint is the fix for a real
    // client report: a match wasn't otherwise obvious without noticing it
    // had expanded/scrolled somewhere, which a plain count doesn't depend on.
    await expect(drawer.getByText(/^No serial matches/)).toHaveCount(0)
    await expect(drawer.getByText('1 match found for')).toBeVisible()
    await expect(drawer.getByText('Sold / removed — no longer on the shelf')).toBeVisible()
    const soldChip = drawer.getByTestId('serial-chip').filter({ hasText: 'SN-2819281' })
    await expect(soldChip).toBeVisible()
    await expect(soldChip.getByText('Sold', { exact: true })).toBeVisible()

    await soldChip.click()

    // Same drill-down every other serial chip opens.
    await expect(drawer.getByRole('button', { name: 'Back to Stock' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(drawer.getByText('SN-2819281', { exact: true })).toBeVisible()
    await expect(drawer.getByText(/Sold to/)).toBeVisible()
  })
})
