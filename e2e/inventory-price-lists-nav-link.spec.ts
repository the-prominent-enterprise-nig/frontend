import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 15 Part 4 — "Price Lists" existed as a real page/feature but had
// no entry in the Inventory sidebar at all, so it was only reachable by
// typing the URL directly. Found live by the developer while testing Part 1.

test('Inventory sidebar links to Price Lists', async ({ page }) => {
  await gotoReady(page, '/inventory/stock')

  const link = page.getByRole('link', { name: 'Price Lists' })
  await expect(link).toBeVisible()
  await link.click()
  await expect(page).toHaveURL('/inventory/price-lists')
  await expect(page.getByRole('heading', { name: 'Price Lists' })).toBeVisible({
    timeout: 10_000,
  })
})
