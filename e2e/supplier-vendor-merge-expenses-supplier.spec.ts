import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 33 (Supplier/Vendor merge) Part 3 — Business Expenses previously
// had a "Vendor" selector (BusinessExpense.vendorId); repointed to Supplier.
// Verifies the "New Expense" form now has a Supplier field instead, and
// that an expense created through it shows the supplier as its payee in the
// list. Self-cleaning: deletes the DRAFT expense it creates.
//
// The Supplier field is targeted positionally (2nd <select> in the form,
// after Category) rather than via getByLabel: this form's Field component
// wraps both the label text AND the <select> in one <label>, so the
// select's computed accessible name is "Supplier" plus its own option
// text — getByLabel(..., { exact: true }) never matches, and a non-exact
// match collides with "Payee (when no supplier)".
test.describe('Accounting — Expenses supplier link', () => {
  test('creates an expense with a linked supplier and shows it as the payee', async ({ page }) => {
    await gotoReady(page, '/accounting/expenses')

    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    const expenseNumbersBefore = new Set(
      await page.locator('tbody tr td:first-child').allTextContents()
    )

    await page.getByRole('button', { name: 'New Expense' }).click()
    await expect(page.getByRole('heading', { name: 'New Expense' })).toBeVisible({
      timeout: 10_000,
    })

    const categorySelect = page.getByLabel('Category (expense account) *')
    await categorySelect
      .locator('option')
      .nth(1)
      .waitFor({ state: 'attached', timeout: 5_000 })
      .catch(() => {})
    await categorySelect.selectOption({ index: 1 })

    // 2nd <select> in the form: Category, Supplier, Payment Method in that
    // order (see comment above on why this isn't getByLabel('Supplier')).
    const supplierSelect = page.locator('form select').nth(1)
    await supplierSelect
      .locator('option')
      .nth(1)
      .waitFor({ state: 'attached', timeout: 5_000 })
      .catch(() => {})
    const supplierOptionCount = await supplierSelect.locator('option').count()
    test.skip(supplierOptionCount <= 1, 'No suppliers seeded — nothing to link')
    await supplierSelect.selectOption({ index: 1 })
    const supplierLabel = (await supplierSelect.locator('option').nth(1).textContent())?.trim()

    const subtotalInput = page.getByLabel('Subtotal *')
    await subtotalInput.fill('250')

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('heading', { name: 'New Expense' })).toHaveCount(0, {
      timeout: 10_000,
    })

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
    if (supplierLabel) {
      await expect(row).toContainText(supplierLabel.split(' — ')[1] ?? supplierLabel)
    }

    // Cleanup — delete the DRAFT expense this test created.
    page.once('dialog', (dialog) => dialog.accept())
    await row.locator('button.text-red-600').click()
    if (expenseNumber) {
      await expect(page.locator('tbody')).not.toContainText(expenseNumber, { timeout: 10_000 })
    }
  })
})
