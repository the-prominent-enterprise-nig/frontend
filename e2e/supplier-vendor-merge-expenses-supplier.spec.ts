import { test, expect } from '@playwright/test'
import { gotoReady, openCustomSelect } from './utils'

// Scenario 33 (Supplier/Vendor merge) Part 3 — Business Expenses previously
// had a "Vendor" selector (BusinessExpense.vendorId); repointed to Supplier.
// Verifies the "New Expense" form has a Supplier field, and that an expense
// created through it shows the supplier as its payee in the list.
// Self-cleaning: deletes the DRAFT expense it creates.
//
// Scenario 40 Gap 1 (2026-08-31) — the form now gates on a Payee type
// (Customer/Supplier/Other) before showing Category/Supplier at all, so this
// test now clicks "Supplier" first.
//
// Scenario 40 (developer feedback, 2026-08-31) — the form moved from a
// modal to its own page (/accounting/expenses/new), per the meeting
// reference example. "New Expense"/"Cancel" are links now, and Save
// navigates back to the list instead of closing an overlay.
//
// Scenario 40 Part 6 (2026-08-31) — Category is now a per-line field inside
// an "Add line" table (aria-label="Category"), and Amount replaced the old
// header-level "Subtotal *" (aria-label="Amount").
//
// Category became a searchable CategorySelect combobox (not a native
// <select>) once the dropdown grew to list every seeded expense account —
// it's opened via its aria-label and its first real option clicked directly,
// since there's nothing to assert about which category ends up chosen here.
//
// Supplier also became a custom Select (src/components/ui/Select.tsx —
// combobox/listbox/option roles, not a native <select>), so it's opened via
// openCustomSelect and its options counted/read through role="option"
// instead of getByLabel(...).selectOption(...) / <option> elements.
test.describe('Accounting — Expenses supplier link', () => {
  test('creates an expense with a linked supplier and shows it as the payee', async ({ page }) => {
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

    await page.getByRole('button', { name: 'Supplier', exact: true }).click()

    await page.getByLabel('Category', { exact: true }).click()
    const categoryDropdown = page.locator('div.absolute.z-50')
    await expect(categoryDropdown).toBeVisible({ timeout: 5_000 })
    // Index 0 is the "— Select —" clear button; index 1 is the first real category.
    await categoryDropdown.locator('button').nth(1).click()

    await openCustomSelect(page.getByRole('combobox', { name: '— None —' }))
    const supplierOptions = page.getByRole('option')
    const supplierOptionCount = await supplierOptions.count()
    test.skip(supplierOptionCount === 0, 'No suppliers seeded — nothing to link')
    const supplierLabel = (await supplierOptions.first().textContent())?.trim()
    await supplierOptions.first().click()

    await page.getByLabel('Amount', { exact: true }).fill('250')

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
