import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 62 Part 2 — Item Master (the former Catalog hub). Tabs: Brands,
// Types, Categories (developer-requested 2026-11-05), the other onboarding
// lists, then Barcodes. Items is hidden (moves to POS). Business Owner
// storage state; the URL stays /inventory/catalog until the Part 6 redirects.

const TAB_ORDER = ['Brands', 'Types', 'Categories', 'Attributes', 'Units of Measure', 'Barcodes']

test.describe('Scenario 62 Part 2 — Item Master', () => {
  test('tabs appear in order and Brands is the default', async ({ page }) => {
    await gotoReady(page, '/inventory/catalog')

    const tabs = page.getByRole('navigation', { name: 'Module tabs' }).getByRole('link')
    await expect(tabs).toHaveText(TAB_ORDER)
    await expect(tabs.first()).toHaveClass(/text-prominent-orange-700/)
  })

  test('?tab=items redirects to the first visible tab', async ({ page }) => {
    await gotoReady(page, '/inventory/catalog?tab=items')
    await expect(page).toHaveURL(/\/inventory\/catalog\?tab=brands/)
  })

  test('each tab renders under the Item Master page', async ({ page }) => {
    for (const tab of ['brands', 'types', 'categories', 'attributes', 'units', 'barcodes']) {
      await gotoReady(page, `/inventory/catalog?tab=${tab}`)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    }
  })
})
