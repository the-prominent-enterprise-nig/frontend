import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 56 Part 6 — Stock Ledger:
//   - "New adjustment" opens the stock-adjustment form (review chain, not a
//     free-form ledger row). Opened and closed only — submitting would leave
//     an adjustment behind for the approval queue.
// The transfer_in → RR link (display, search and backfill) is covered in
// backend/test/stock-transfer-serial-in-transit.e2e-spec.ts.

test.describe('Scenario 56 Part 6 — Stock Ledger', () => {
  test('New adjustment opens the adjustment form', async ({ page }) => {
    await gotoReady(page, '/inventory/stock?tab=ledger')
    await page.getByRole('button', { name: 'New adjustment' }).click()
    await expect(page.getByRole('heading', { name: 'New stock adjustment' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('button', { name: 'Submit for review' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'New stock adjustment' })).toHaveCount(0)
  })
})
