import { test, expect } from '@playwright/test'
import { gotoReady, pickFromCustomSelect } from './utils'

// Scenario 45 — Utilities and Salaries & Wages are Payee options of their
// own (alongside Customer/Supplier/Special Account) instead of being two
// rows among 160 in the Category search. Both are payeeType SUPPLIER
// underneath; picking one pre-fills the line's category, which stays fully
// editable. Self-cleaning: each test deletes the DRAFT expense it creates.
//
// Payee is a dropdown, not a row of tiles (developer feedback 2026-09-02 —
// the options behave the same except Special Account, so tiles over-weighted
// them), hence pickFromCustomSelect rather than clicking a button by name.
test.describe('Accounting — Expenses category quick-pick (Scenario 45)', () => {
  test('Utilities pre-fills the line category and still allows changing it', async ({ page }) => {
    await gotoReady(page, '/accounting/expenses')
    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    const before = new Set(await page.locator('tbody tr td:first-child').allTextContents())

    await page.getByRole('link', { name: 'New Expense' }).click()
    await page.waitForURL('**/accounting/expenses/new')
    await expect(page.getByRole('heading', { name: 'New Expense' })).toBeVisible({
      timeout: 10_000,
    })

    await pickFromCustomSelect(page, '— Select —', 'Utilities')

    // Pre-filled, not locked — the ordinary searchable picker still renders.
    const categoryField = page.getByLabel('Category', { exact: true })
    await expect(categoryField).toHaveText('Utilities - Electricity/Water/Internet', {
      timeout: 5_000,
    })
    await categoryField.click()
    await expect(page.getByPlaceholder('Search categories…')).toBeVisible({ timeout: 5_000 })
    await page.keyboard.press('Escape')

    // Still the ordinary Supplier sub-flow underneath — free-text payee works.
    await page.getByPlaceholder('e.g. Meralco').fill('E2E Quick-Pick Utilities Co.')
    await page.getByLabel('Amount', { exact: true }).fill('2500')

    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForURL('**/accounting/expenses', { timeout: 10_000 })

    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    await expect
      .poll(
        async () => {
          const current = await page.locator('tbody tr td:first-child').allTextContents()
          return current.filter((n) => !before.has(n)).length
        },
        { timeout: 10_000 }
      )
      .toBeGreaterThan(0)
    const after = await page.locator('tbody tr td:first-child').allTextContents()
    const expenseNumber = after.find((n) => !before.has(n))
    expect(expenseNumber).toBeTruthy()
    const row = page.locator('tbody tr', { hasText: expenseNumber as string })
    await expect(row).toContainText('E2E Quick-Pick Utilities Co.')
    await expect(row).toContainText('Utilities')

    // Cleanup
    page.once('dialog', (dialog) => dialog.accept())
    await row.locator('button.text-red-600').click()
    if (expenseNumber) {
      await expect(page.locator('tbody')).not.toContainText(expenseNumber, { timeout: 10_000 })
    }
  })

  test('Salaries & Wages pre-fills the payroll expense account', async ({ page }) => {
    await gotoReady(page, '/accounting/expenses')
    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    const before = new Set(await page.locator('tbody tr td:first-child').allTextContents())

    await page.getByRole('link', { name: 'New Expense' }).click()
    await page.waitForURL('**/accounting/expenses/new')
    await expect(page.getByRole('heading', { name: 'New Expense' })).toBeVisible({
      timeout: 10_000,
    })

    await pickFromCustomSelect(page, '— Select —', 'Salaries & Wages')
    await expect(page.getByLabel('Category', { exact: true })).toHaveText('Salaries and Wages', {
      timeout: 5_000,
    })

    await page.getByPlaceholder('e.g. Meralco').fill('E2E Payroll Run')
    await page.getByLabel('Amount', { exact: true }).fill('1000000')

    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForURL('**/accounting/expenses', { timeout: 10_000 })

    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    await expect
      .poll(
        async () => {
          const current = await page.locator('tbody tr td:first-child').allTextContents()
          return current.filter((n) => !before.has(n)).length
        },
        { timeout: 10_000 }
      )
      .toBeGreaterThan(0)
    const after = await page.locator('tbody tr td:first-child').allTextContents()
    const expenseNumber = after.find((n) => !before.has(n))
    expect(expenseNumber).toBeTruthy()
    const row = page.locator('tbody tr', { hasText: expenseNumber as string })
    await expect(row).toContainText('E2E Payroll Run')
    await expect(row).toContainText('Salaries and Wages')

    // Cleanup
    page.once('dialog', (dialog) => dialog.accept())
    await row.locator('button.text-red-600').click()
    if (expenseNumber) {
      await expect(page.locator('tbody')).not.toContainText(expenseNumber, { timeout: 10_000 })
    }
  })

  test('switching to plain Supplier clears the pre-filled category', async ({ page }) => {
    await gotoReady(page, '/accounting/expenses/new')
    await expect(page.getByRole('heading', { name: 'New Expense' })).toBeVisible({
      timeout: 10_000,
    })

    await pickFromCustomSelect(page, '— Select —', 'Utilities')
    await expect(page.getByLabel('Category', { exact: true })).toHaveText(
      'Utilities - Electricity/Water/Internet',
      { timeout: 5_000 }
    )

    await pickFromCustomSelect(page, 'Utilities', 'Supplier')
    await expect(page.getByLabel('Category', { exact: true })).toHaveText('— Select —', {
      timeout: 5_000,
    })
  })
})
