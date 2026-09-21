import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 56 Part 8 — PO → Inventory → PO. The status pill lives in the URL
// (?status=), so leaving the PO list and coming back lands on the same
// filter instead of resetting to All. Cache invalidation of a PO opened by
// id is a data-freshness fix with no stable UI hook to assert on. Read-only.

test.describe('Scenario 56 Part 8 — PO navigation', () => {
  test('status filter survives leaving for Inventory and coming back', async ({ page }) => {
    await gotoReady(page, '/inventory/purchase-orders?tab=orders')
    const approved = page.getByRole('button', { name: 'Approved', exact: true })
    await expect(approved).toBeVisible({ timeout: 20_000 })
    await approved.click()
    await expect(page).toHaveURL(/status=approved/)

    await gotoReady(page, '/inventory/stock?tab=balance')
    await page.goBack()
    await expect(page).toHaveURL(/status=approved/)
    await expect(page.getByRole('button', { name: 'Approved', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
      { timeout: 20_000 }
    )
  })
})
