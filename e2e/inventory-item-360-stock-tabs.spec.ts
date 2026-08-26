import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

test.describe('Inventory — Item 360 drawer, opened from Stock Balance', () => {
  test('clicking a row opens the drawer scoped to Stock, with Serials/Movements and quick actions, no Overview', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/stock')

    const searchInput = page.getByPlaceholder('Search item name, SKU, or serial number…')
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
    await row.click()

    // Stock tab is the default for this context and its content shows directly.
    await expect(page.getByRole('navigation', { name: 'Item 360 tabs' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('button', { name: 'Stock', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Serials' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Movements' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Overview' })).toHaveCount(0)
    // History was consolidated into Movements — no separate tab anymore.
    await expect(page.getByRole('button', { name: 'History' })).toHaveCount(0)

    // Operational quick actions belong here, unlike the Catalog-opened drawer.
    await expect(page.getByRole('link', { name: 'Receive Stock' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Transfer', exact: true })).toBeVisible()

    // Switching to Serials actually loads serial rows for this item — seeded
    // with 200 in-stock serials per branch (prisma/seed.ts), so the empty
    // state must not show.
    await page.getByRole('button', { name: 'Serials' }).click()
    await expect(page.getByText('No serial numbers yet')).toHaveCount(0, { timeout: 10_000 })
    await expect(page.getByText('Serial #', { exact: true })).toBeVisible()
  })
})
