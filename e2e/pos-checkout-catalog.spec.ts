import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// POS Checkout — Item Catalog. Full serialized-sale flows (branch-scoped
// serials, dual-serial items, furniture sets) need seeded branch/warehouse/
// serial fixtures and are covered by the backend e2e suite
// (test/pos-serial-branch-scoping.e2e-spec.ts); this spec sticks to UI-surface
// checks that don't depend on that data.
test.describe('POS Checkout — Item Catalog', () => {
  test('excludes Menu Items from navigation and the item picker', async ({ page }) => {
    await gotoReady(page, '/pos')
    await expect(page.getByRole('link', { name: 'Menu Items' })).toHaveCount(0)

    await gotoReady(page, '/pos/checkout')
    await expect(page.getByRole('button', { name: 'Menu Items' })).toHaveCount(0)
    await expect(page.getByPlaceholder('Search by name or serial')).toBeVisible()
  })
})
