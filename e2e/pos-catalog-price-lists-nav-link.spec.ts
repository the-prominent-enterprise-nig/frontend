import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Price Lists moved out of Inventory (Master Data / Finance tabs, the home
// tile and /inventory/price-lists) and into POS. Originally Scenario 15 Part 4 —
// Price Lists had no sidebar entry at all and was only reachable by typing the
// URL. It sat beside Product Catalog for a while; the client has it under
// Operations & Admin now (see pos/_shared/pos-hubs.ts), for Business Owner and
// Head Office only. The role boundary is in pos-sidebar-hubs.spec.ts.

test('Operations & Admin leads to Price Lists', async ({ page }) => {
  await gotoReady(page, '/pos/service-jobs')

  const tabs = page.getByRole('navigation', { name: 'POS section tabs' })
  const tab = tabs.getByRole('link', { name: 'Price Lists' })
  await expect(tab).toBeVisible()
  await expect(async () => {
    await tab.click()
    await expect(page).toHaveURL('/pos/price-lists', { timeout: 3_000 })
  }).toPass({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Price Lists' })).toBeVisible({
    timeout: 10_000,
  })
  await expect(tabs.getByRole('link', { name: 'Service Jobs' })).toBeVisible()

  // The strip, and the sidebar's one Operations & Admin row, stay on the upload page too.
  await gotoReady(page, '/pos/price-lists/upload')
  await expect(tabs).toBeVisible()
  await expect(
    page.locator('aside').getByRole('link', { name: 'Operations & Admin', exact: true })
  ).toHaveClass(/bg-prominent-orange-200\/20/)
})

test('the old Inventory and Product Catalog addresses land on Price Lists', async ({ page }) => {
  await gotoReady(page, '/inventory/price-lists')
  await expect(page).toHaveURL('/pos/price-lists', { timeout: 20_000 })
})
