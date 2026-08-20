import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

test.describe('Inventory — Item 360 drawer, opened from Catalog', () => {
  test('shows Overview only, no tab bar, no SKU/Tracking fields, no operational tabs or actions', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/items')
    const searchInput = page.getByPlaceholder('Search by name, SKU, or serial number…')
    await expect(searchInput).toBeVisible({ timeout: 15_000 })

    const firstRow = page.locator('tbody tr').first()
    await expect(firstRow).toBeVisible({ timeout: 10_000 })
    await firstRow.click()

    // Overview's own content shows directly — Substitutes was removed (unused
    // feature) leaving Catalog with a single tab, so no tab bar renders at all.
    await expect(page.getByText('Category', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('navigation', { name: 'Item 360 tabs' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Overview' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Substitutes' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Stock', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Serials' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Movements' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'History' })).toHaveCount(0)

    // Operational quick actions don't belong on a plain look-and-read view.
    await expect(page.getByRole('link', { name: 'Receive Stock' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Transfer', exact: true })).toHaveCount(0)

    // Overview still shows product-definition fields...
    await expect(page.getByText('Subcategory', { exact: true })).toBeVisible()
    // ...but no separate SKU field row or Tracking section (SKU stays in the header only).
    await expect(page.getByText('SKU', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Tracking', { exact: true })).toHaveCount(0)
  })
})
