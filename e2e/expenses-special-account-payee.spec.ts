import { test, expect } from '@playwright/test'
import { gotoReady, pickFromCustomSelect } from './utils'

// Scenario 40 Part 1 — the Expense form's Payee field is now typed
// (Customer/Supplier/Other); Other unlocks a Special Account list
// (Employee Cash Advance/Loan, Cash Loan – Others) instead of the plain
// Category dropdown. Both cases here are self-cleaning: each deletes the
// DRAFT expense it creates.
//
// Scenario 40 Part 6 (2026-08-31) — one entry is now a header + N lines
// (an "Add line" table); these tests use a single line each, targeting the
// line's own inputs (aria-label="Category"/"Amount") rather than the old
// header-level "Category (expense account) *"/"Subtotal *" fields.
//
// "Special Account type *" became a custom Select (src/components/ui/
// Select.tsx — combobox/listbox/option roles, not a native <select>), so
// it's driven via pickFromCustomSelect by its placeholder/current label
// rather than getByLabel(...).selectOption(...).
//
// Scenario 45 (2026-09-02) — the Payee tile is labeled "Special Account"
// now, and Recipient is a plain text field for every Special Account type:
// Employee Cash Advance/Loan no longer pick a real employee record, so
// there's no employeeId link and no employee search box anywhere here.
test.describe('Accounting — Expenses Special Account payee (Scenario 40 Part 1)', () => {
  test('records an Employee Cash Advance against a typed recipient, not the ordinary category list', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/expenses')
    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    const expenseNumbersBefore = new Set(
      await page.locator('tbody tr td:first-child').allTextContents()
    )

    await page.getByRole('link', { name: 'New Expense' }).click()
    await page.waitForURL('**/accounting/expenses/new')
    await expect(page.getByRole('heading', { name: 'New Expense' })).toBeVisible({
      timeout: 10_000,
    })

    // Before choosing a Payee type, no line items table renders.
    await expect(page.getByLabel('Category', { exact: true })).toHaveCount(0)
    await expect(page.getByLabel('Amount', { exact: true })).toHaveCount(0)

    await pickFromCustomSelect(page, '— Select —', 'Special Account')
    await pickFromCustomSelect(page, '— Select —', 'Employee Cash Advance')

    // Choosing Other never re-shows the ordinary Category column.
    await expect(page.getByLabel('Category', { exact: true })).toHaveCount(0)

    // Free text, not an employee search — the picker is gone entirely.
    await expect(page.getByPlaceholder('Search employee by name or code…')).toHaveCount(0)
    const recipientLabel = 'E2E Cash Advance Recipient'
    const recipientInput = page.getByLabel('Recipient', { exact: true })
    await expect(recipientInput).toBeVisible({ timeout: 5_000 })
    await recipientInput.fill(recipientLabel)

    await page.getByLabel('Amount', { exact: true }).fill('5000')

    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForURL('**/accounting/expenses', { timeout: 10_000 })

    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    await expect
      .poll(
        async () => {
          const current = await page.locator('tbody tr td:first-child').allTextContents()
          return current.filter((n) => !expenseNumbersBefore.has(n)).length
        },
        { timeout: 10_000 }
      )
      .toBeGreaterThan(0)
    const expenseNumbersAfter = await page.locator('tbody tr td:first-child').allTextContents()
    const expenseNumber = expenseNumbersAfter.find((n) => !expenseNumbersBefore.has(n))
    expect(expenseNumber).toBeTruthy()
    const row = page.locator('tbody tr', { hasText: expenseNumber as string })
    await expect(row).toContainText(recipientLabel)
    await expect(row).toContainText('Employee Cash Advance')

    // Cleanup
    page.once('dialog', (dialog) => dialog.accept())
    await row.locator('button.text-red-600').click()
    if (expenseNumber) {
      await expect(page.locator('tbody')).not.toContainText(expenseNumber, { timeout: 10_000 })
    }
  })

  test('records a Cash Loan – Others entry with a free-text payee, no employee required', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/expenses')
    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    const expenseNumbersBefore = new Set(
      await page.locator('tbody tr td:first-child').allTextContents()
    )

    await page.getByRole('link', { name: 'New Expense' }).click()
    await page.waitForURL('**/accounting/expenses/new')
    await expect(page.getByRole('heading', { name: 'New Expense' })).toBeVisible({
      timeout: 10_000,
    })

    await pickFromCustomSelect(page, '— Select —', 'Special Account')
    await pickFromCustomSelect(page, '— Select —', 'Cash Loan – Others')

    // Free text, not an employee search — the picker never renders here.
    await expect(page.getByPlaceholder('Search employee by name or code…')).toHaveCount(0)
    const payeeInput = page.getByLabel('Recipient', { exact: true })
    await expect(payeeInput).toBeVisible({ timeout: 5_000 })
    await payeeInput.fill('E2E Non-Employee Cash Loan Party')

    await page.getByLabel('Amount', { exact: true }).fill('1500')

    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForURL('**/accounting/expenses', { timeout: 10_000 })

    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    await expect
      .poll(
        async () => {
          const current = await page.locator('tbody tr td:first-child').allTextContents()
          return current.filter((n) => !expenseNumbersBefore.has(n)).length
        },
        { timeout: 10_000 }
      )
      .toBeGreaterThan(0)
    const expenseNumbersAfter = await page.locator('tbody tr td:first-child').allTextContents()
    const expenseNumber = expenseNumbersAfter.find((n) => !expenseNumbersBefore.has(n))
    expect(expenseNumber).toBeTruthy()
    const row = page.locator('tbody tr', { hasText: expenseNumber as string })
    await expect(row).toContainText('E2E Non-Employee Cash Loan Party')
    await expect(row).toContainText('Cash Loan')

    // Cleanup
    page.once('dialog', (dialog) => dialog.accept())
    await row.locator('button.text-red-600').click()
    if (expenseNumber) {
      await expect(page.locator('tbody')).not.toContainText(expenseNumber, { timeout: 10_000 })
    }
  })
})
