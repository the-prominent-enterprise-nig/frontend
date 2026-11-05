import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 87 Part 2 — Stock Count is now Physical Inventory, a tab of the
// Stock Report beside Aging of Inventory. The old Counting hub keeps
// Stock Adjustments / Mobile Count / Batches; its bare URL and its old
// ?tab=counts both redirect to the new tab. Read-only (opens the New
// Physical Inventory modal and closes it), so nothing to clean up.

test.describe('Scenario 87 Part 2 — Physical Inventory under Stock Report', () => {
  test('Stock Report has Aging of Inventory and Physical Inventory tabs', async ({ page }) => {
    await gotoReady(page, '/inventory/reports')
    const tabs = page.getByRole('navigation', { name: 'Module tabs' })
    await expect(tabs.getByRole('link', { name: 'Aging of Inventory' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('heading', { name: 'Inventory Aging Report' })).toBeVisible()

    await tabs.getByRole('link', { name: 'Physical Inventory' }).click()
    await expect(page).toHaveURL(/tab=physical-inventory/)
    await expect(page.getByRole('heading', { name: 'Physical Inventory', level: 1 })).toBeVisible({
      timeout: 20_000,
    })

    await page.getByRole('button', { name: 'New Physical Inventory' }).click()
    await expect(page.getByRole('heading', { name: 'New Physical Inventory' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Physical Inventory' })).toBeVisible()
  })

  for (const oldUrl of ['/inventory/counting', '/inventory/counting?tab=counts']) {
    test(`${oldUrl} redirects to Physical Inventory`, async ({ page }) => {
      await gotoReady(page, oldUrl)
      await expect(page).toHaveURL(/\/inventory\/reports\?tab=physical-inventory/, {
        timeout: 20_000,
      })
      await expect(
        page.getByRole('heading', { name: 'Physical Inventory', level: 1 })
      ).toBeVisible()
    })
  }

  test('the Counting hub no longer has a Stock Counts tab', async ({ page }) => {
    await gotoReady(page, '/inventory/counting?tab=adjustments')
    const tabs = page.getByRole('navigation', { name: 'Module tabs' })
    await expect(tabs.getByRole('link', { name: 'Stock Adjustments' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(tabs.getByRole('link', { name: 'Stock Counts' })).toHaveCount(0)
  })
})
