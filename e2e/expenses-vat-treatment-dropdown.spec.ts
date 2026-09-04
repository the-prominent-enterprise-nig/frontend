import { test, expect } from '@playwright/test'
import { gotoReady, pickFromCustomSelect } from './utils'

// VAT on an expense line is a treatment picked from a dropdown — Non-taxable
// or Input VAT (12%) — not a figure typed by hand. The amount is derived from
// the treatment (here for the running total, and again server-side for what
// actually posts), so a VAT figure can no longer disagree with the line it
// sits on. Self-cleaning: deletes the DRAFT expense it creates.
test.describe('Accounting — Expense line VAT treatment', () => {
  test('derives 12% Input VAT from the amount and totals it', async ({ page }) => {
    await gotoReady(page, '/accounting/expenses/new')
    await expect(page.getByRole('heading', { name: 'New Expense' })).toBeVisible({
      timeout: 10_000,
    })

    await pickFromCustomSelect(page, '— Select —', 'Utilities')
    await page.getByPlaceholder('e.g. Meralco').fill('E2E VAT Treatment Co.')
    await page.getByLabel('Amount', { exact: true }).fill('1000')

    // Non-taxable by default — the total is the bare amount, and the totals
    // block carries no VAT row at all.
    const totals = page.getByText('Total:').locator('..')
    await expect(totals).toContainText('₱1,000.00', { timeout: 5_000 })
    await expect(totals).not.toContainText('VAT')

    await pickFromCustomSelect(page, 'Non-taxable', 'Input VAT (12%)')

    // 12% of 1,000 — computed, never typed.
    await expect(totals).toContainText('₱120.00', { timeout: 5_000 })
    await expect(totals).toContainText('₱1,120.00')

    // There is no free-text VAT box left to disagree with it.
    await expect(page.getByLabel('VAT', { exact: true })).toHaveCount(0)
  })
})
