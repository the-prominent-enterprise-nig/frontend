import { test, expect } from '@playwright/test'
import { gotoReady, pickFromCustomSelect } from './utils'

// VAT on an expense line is a tax code picked from a dropdown, and the amount is
// derived from it — here as the figure under the code, and again server-side for
// what actually posts — rather than typed by hand. So a VAT figure can no longer
// disagree with the line it sits on.
//
// A purchase (a Supplier's, or an Other payee that is not a payroll run) starts
// on Input VAT; everything else starts on Non-VAT. Amounts are VAT-inclusive:
// the 12% is split OUT of what is typed (12/112), never added on top.
//
// Never saves, so nothing is created.
test.describe('Accounting — Expense line VAT treatment', () => {
  test('a purchase line starts on Input VAT and splits the 12% out of the amount', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/expenses/new')
    await expect(page.getByRole('heading', { name: 'New Expense' })).toBeVisible({
      timeout: 10_000,
    })

    // Other keeps the generic line grid (no Item/Qty columns) and needs
    // only a free-text label.
    await pickFromCustomSelect(page, '— Select —', 'Other')
    await page.locator('input[aria-label="Amount"]').first().fill('1000')

    // Input VAT by default — no need to switch it on for every line.
    await expect(page.getByRole('combobox', { name: 'Input VAT' })).toBeVisible()
    // 1,000 × 12/112 — computed, never typed, and shown under the code.
    await expect(page.locator('[aria-label="Tax amount"]').first()).toHaveText('₱107.14 VAT', {
      timeout: 5_000,
    })
    // The total is the bare amount: the VAT is inside it, not on top.
    await expect(page.getByText('Total:').locator('..')).toContainText('₱1,000.00')

    // Non-VAT has no VAT to show.
    await pickFromCustomSelect(page, 'Input VAT', 'Non-VAT')
    await expect(page.locator('[aria-label="Tax amount"]')).toHaveCount(0)

    // The tax amount is a read-out, not an input — nothing to type into.
    await expect(page.locator('input[aria-label="Tax amount"]')).toHaveCount(0)
  })

  test('a payroll run, a customer refund and an advance start on Non-VAT', async ({ page }) => {
    await gotoReady(page, '/accounting/expenses/new')
    await expect(page.getByRole('heading', { name: 'New Expense' })).toBeVisible({
      timeout: 10_000,
    })

    // Customer: a refund is not a purchase.
    await pickFromCustomSelect(page, '— Select —', 'Customer')
    await expect(page.getByRole('combobox', { name: 'Non-VAT' }).first()).toBeVisible()

    // Other, then called a payroll run: VAT on a salary would post to the books.
    await pickFromCustomSelect(page, 'Customer', 'Other')
    await expect(page.getByRole('combobox', { name: 'Input VAT' })).toBeVisible()
    const category = page.locator('label', { hasText: 'Category' }).getByRole('combobox')
    await category.click()
    await page.getByRole('option', { name: 'Payroll', exact: true }).click()
    await expect(page.getByRole('combobox', { name: 'Non-VAT' }).first()).toBeVisible()
  })
})
