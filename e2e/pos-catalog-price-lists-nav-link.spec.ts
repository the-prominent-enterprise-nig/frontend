import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Price Lists moved out of Inventory (Master Data / Finance tabs, the home
// tile and /inventory/price-lists) and into POS. Originally Scenario 15 Part 4 —
// Price Lists had no sidebar entry at all and was only reachable by typing the
// URL. It is a tab beside Product Catalog now (see pos/_shared/pos-hubs.ts) — not
// a Sales Counter tab, and not under Operations & Admin as the client doc has it.

test('Product Catalog leads to Price Lists, beside it', async ({ page }) => {
  await gotoReady(page, '/pos/catalog')

  const tabs = page.getByRole('navigation', { name: 'POS section tabs' })
  const tab = tabs.getByRole('link', { name: 'Price Lists' })
  await expect(tab).toBeVisible()
  await expect(async () => {
    await tab.click()
    await expect(page).toHaveURL('/pos/catalog/price-lists', { timeout: 3_000 })
  }).toPass({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Price Lists' })).toBeVisible({
    timeout: 10_000,
  })
  await expect(tabs.getByRole('link', { name: 'Product Catalog' })).toBeVisible()

  // The strip, and the sidebar's one Product Catalog row, stay on the upload page too.
  await gotoReady(page, '/pos/catalog/price-lists/upload')
  await expect(tabs).toBeVisible()
  await expect(
    page.locator('aside').getByRole('link', { name: 'Product Catalog', exact: true })
  ).toHaveClass(/bg-prominent-orange-200\/20/)
})
