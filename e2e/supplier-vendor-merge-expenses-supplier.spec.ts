import { test, expect } from '@playwright/test'
import { gotoReady, pickFromCustomSelect } from './utils'

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
// Supplier became a custom Select (src/components/ui/Select.tsx) and then,
// in Scenario 45, a searchable CategorySelect — a plain button with a
// filterable popup rather than a combobox — so it's opened by its
// aria-label and its options read out of that popup's scroll list.
//
// Scenario 45 (2026-09-02) — Payee is a dropdown rather than a row of
// tiles, so picking "Supplier" goes through pickFromCustomSelect.
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

    await pickFromCustomSelect(page, '— Select —', 'Supplier')

    await page.getByLabel('Category', { exact: true }).click()
    const categoryDropdown = page.locator('div.absolute.z-50')
    await expect(categoryDropdown).toBeVisible({ timeout: 5_000 })
    // Index 0 is the "— Select —" clear button; index 1 is the first real category.
    await categoryDropdown.locator('button').nth(1).click()

    // Scenario 45 — Supplier is a searchable CategorySelect now, not a plain
    // combobox, so its options are rows in that popup's own scroll list.
    // Index 0 is the "— None —" clear row; index 1 is the first real supplier.
    await page.getByLabel('Select supplier', { exact: true }).click()
    const supplierOptions = page.locator('.max-h-60 button')
    const supplierOptionCount = await supplierOptions.count()
    test.skip(supplierOptionCount <= 1, 'No suppliers seeded — nothing to link')
    const supplierLabel = (await supplierOptions.nth(1).textContent())?.trim()
    await supplierOptions.nth(1).click()

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
