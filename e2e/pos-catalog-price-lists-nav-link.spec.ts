import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Price Lists moved out of Inventory (Master Data / Finance tabs, the home
// tile and /inventory/price-lists) and into POS. Originally Scenario 15 Part 4 —
// Price Lists had no sidebar entry at all and was only reachable by typing the
// URL. It is "Price List Upload" in POS's Operations & Admin group now, beside
// Service Jobs, POS PIN and Settings (see pos/_shared/pos-hubs.ts).

test('Operations & Admin leads to Price List Upload', async ({ page }) => {
  await gotoReady(page, '/pos/admin')

  const posTabs = page.getByRole('navigation', { name: 'POS section tabs' })
  const tab = posTabs.getByRole('link', { name: 'Price List Upload' })
  await expect(tab).toBeVisible()
  await expect(async () => {
    await tab.click()
    await expect(page).toHaveURL('/pos/catalog/price-lists', { timeout: 3_000 })
  }).toPass({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Price Lists' })).toBeVisible({
    timeout: 10_000,
  })
  // The group's strip stays put, here and on the upload page.
  await expect(posTabs).toBeVisible()
  await expect(posTabs.getByRole('link', { name: 'Service Jobs' })).toBeVisible()

  await gotoReady(page, '/pos/catalog/price-lists/upload')
  await expect(posTabs).toBeVisible()
})

test('Inventory no longer carries Price Lists', async ({ page }) => {
  await gotoReady(page, '/inventory/master-data')
  await expect(page.getByRole('link', { name: 'Warehouses' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Price Lists' })).toHaveCount(0)

  await gotoReady(page, '/inventory/finance')
  await expect(page.getByRole('link', { name: 'Costing & COGS' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Price Lists' })).toHaveCount(0)
})

test('the old Inventory URL redirects to the POS address', async ({ page }) => {
  await gotoReady(page, '/inventory/price-lists')
  await expect(page).toHaveURL('/pos/catalog/price-lists')
})
