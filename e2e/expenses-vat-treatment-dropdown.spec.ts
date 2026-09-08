import { test, expect } from '@playwright/test'
import { gotoReady, pickFromCustomSelect } from './utils'

// VAT on an expense line is a tax code picked from a dropdown, and the
// amount is derived from it — here for the running total, and again
// server-side for what actually posts — rather than typed by hand. So a VAT
// figure can no longer disagree with the line it sits on.
test.describe('Accounting — Expense line VAT treatment', () => {
  test('derives 12% Input VAT from the amount and totals it', async ({ page }) => {
    await gotoReady(page, '/accounting/expenses/new')
    await expect(page.getByRole('heading', { name: 'New Expense' })).toBeVisible({
      timeout: 10_000,
    })

    // Other keeps the generic line grid (no Item/Qty columns) and needs
    // only a free-text label.
    await pickFromCustomSelect(page, '— Select —', 'Other')
    await page.locator('input[aria-label="Amount"]').first().fill('1000')

    // Non-taxable by default — the total is the bare amount, and the totals
    // block carries no VAT row at all.
    const totals = page.getByText('Total:').locator('..')
    await expect(totals).toContainText('₱1,000.00', { timeout: 5_000 })
    await expect(totals).not.toContainText('VAT')

    await pickFromCustomSelect(page, 'No Tax', 'Input VAT')

    // 12% of 1,000 — computed, never typed.
    await expect(totals).toContainText('₱120.00', { timeout: 5_000 })
    await expect(totals).toContainText('₱1,120.00')

    // The tax amount is a read-out, not an input — nothing to type into.
    await expect(page.locator('input[aria-label="Tax amount"]')).toHaveCount(0)
  })
})
