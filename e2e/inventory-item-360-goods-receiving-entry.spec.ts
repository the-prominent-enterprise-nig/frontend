import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Scenario 35, Part 3 — Goods Receiving's "view item details" icon is one of
// the two remaining entry points into the shared Item 360 drawer; it must
// land on the Stock-flavored tab set, same as Stock → Balance's own entry
// point (already covered by inventory-item-360-stock-tabs.spec.ts).
test.describe('Inventory — Item 360 drawer, opened from Goods Receiving', () => {
  test('view item details icon opens the drawer scoped to Stock, not Catalog', async ({ page }) => {
    await gotoReady(page, '/inventory/operations?tab=receiving')

    const searchInput = page.getByPlaceholder('Search items…')
    await expect(searchInput).toBeVisible({ timeout: 15_000 })

    // A later hydration reconciliation on this page can silently wipe the
    // search value after fillStable's own check has already passed (the same
    // race fillAllStable's docstring describes for multi-field forms) —
    // retry the fill itself until the filtered row actually shows up, rather
    // than trusting a single fill to survive.
    const row = page.locator('tbody tr', { hasText: 'Washing Machine' }).first()
    await expect(async () => {
      await fillStable(searchInput, 'Washing Machine')
      await expect(row).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 30_000 })
    await row.getByRole('button', { name: 'View item details' }).click()

    // The underlying Goods Receiving table (each row has its own "History"
    // button) stays mounted behind the drawer overlay, so tab assertions must
    // be scoped to the drawer's own tab nav rather than the whole page.
    const drawerTabs = page.getByRole('navigation', { name: 'Item 360 tabs' })
    await expect(drawerTabs).toBeVisible({ timeout: 10_000 })
    await expect(drawerTabs.getByRole('button', { name: 'Stock', exact: true })).toBeVisible()
    await expect(drawerTabs.getByRole('button', { name: 'Serials' })).toBeVisible()
    await expect(drawerTabs.getByRole('button', { name: 'Movements' })).toBeVisible()
    await expect(drawerTabs.getByRole('button', { name: 'Overview' })).toHaveCount(0)
    // History was consolidated into Movements — no separate tab anymore.
    await expect(drawerTabs.getByRole('button', { name: 'History' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Receive Stock' })).toBeVisible()
  })
})
