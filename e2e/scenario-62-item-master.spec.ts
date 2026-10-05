import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 62 Part 2 — Item Master (the former Catalog hub). Tabs follow the
// sketch: onboarding lists first, then Barcodes. Items is hidden (moves to POS). Business Owner
// storage state; the URL stays /inventory/catalog until the Part 6 redirects.

const TAB_ORDER = ['Categories', 'Brands', 'Types', 'Attributes', 'Units of Measure', 'Barcodes']

test.describe('Scenario 62 Part 2 — Item Master', () => {
  test('tabs appear in sketch order and Categories is the default', async ({ page }) => {
    await gotoReady(page, '/inventory/catalog')

    const tabs = page.getByRole('navigation', { name: 'Module tabs' }).getByRole('link')
    await expect(tabs).toHaveText(TAB_ORDER)
    await expect(tabs.first()).toHaveClass(/text-prominent-orange-700/)
  })

  test('?tab=items redirects to the first visible tab', async ({ page }) => {
    await gotoReady(page, '/inventory/catalog?tab=items')
    await expect(page).toHaveURL(/\/inventory\/catalog\?tab=categories/)
  })

  test('each tab renders under the Item Master page', async ({ page }) => {
    for (const tab of ['categories', 'brands', 'types', 'attributes', 'units', 'barcodes']) {
      await gotoReady(page, `/inventory/catalog?tab=${tab}`)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    }
  })
})
