import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Warehouses moved from Inventory → Master Data to Settings → Branches, beside
// the branches. Business Owner storage state.

test.describe('Warehouses sit under Branches', () => {
  test('the Branches page has a Branches tab and a Warehouses tab, Branches first', async ({
    page,
  }) => {
    await gotoReady(page, '/settings/branches')

    const tabs = page.getByRole('navigation', { name: 'Module tabs' }).getByRole('link')
    await expect(tabs).toHaveText(['Branches', 'Warehouses'])
    await expect(page.getByRole('heading', { level: 1, name: 'Branches' })).toBeVisible()
  })

  test('the Warehouses tab shows the warehouses', async ({ page }) => {
    await gotoReady(page, '/settings/branches?tab=warehouses')

    await expect(page.getByRole('heading', { name: 'Warehouses' }).first()).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Module tabs' }).getByRole('link', {
        name: 'Warehouses',
        exact: true,
      })
    ).toHaveClass(/text-prominent-orange-700/)
  })

  test('the old Warehouses address redirects to the Warehouses tab', async ({ page }) => {
    await gotoReady(page, '/inventory/warehouses')
    await expect(page).toHaveURL(/\/settings\/branches\?tab=warehouses/)
  })

  test('Master Data no longer has a Warehouses tab', async ({ page }) => {
    await gotoReady(page, '/inventory/master-data')

    const tabs = page.getByRole('navigation', { name: 'Module tabs' })
    await expect(tabs.getByRole('link', { name: 'Warehouses', exact: true })).toHaveCount(0)
  })
})
