import { test, expect } from '@playwright/test'
import { gotoReady, pickFromCustomSelect } from './utils'

// Scenario 45 (developer feedback, 2026-09-02) — two bugs surfaced while
// manually testing the quick-pick tiles:
//
// 1. The line items table's outer container had `overflow-hidden` (for its
//    rounded corners), which also clipped the Category dropdown's popup
//    whenever it opened upward (position:absolute escapes a border but not
//    overflow clipping) — a latent bug since Scenario 40, made much more
//    likely to trigger by this scenario's layout change (Date moved above
//    Payee, pushing the line items table down and leaving less room below
//    the trigger). Fixed by rounding the header directly instead of relying
//    on overflow-hidden on the container.
// 2. The Supplier field was a plain, unsearchable listbox scrolling through
//    every seeded supplier — now reuses CategorySelect (search + flat list,
//    depth 0) the same way Category itself already does.
test.describe('Accounting — Expenses Category/Supplier dropdown popups (Scenario 45 fixes)', () => {
  test('Category popup renders fully and stays clickable when it opens upward', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/expenses/new')
    await expect(page.getByRole('heading', { name: 'New Expense' })).toBeVisible({
      timeout: 10_000,
    })
    await pickFromCustomSelect(page, '— Select —', 'Customer')
    await page.getByLabel('Category', { exact: true }).click()

    const search = page.getByPlaceholder('Search categories…')
    await expect(search).toBeVisible({ timeout: 5_000 })
    // The popup isn't clipped down to a single stray fragment — several real
    // option rows are visible and actually clickable, not just present in
    // the DOM behind a clipped ancestor.
    await search.fill('Cost of Installation')
    const option = page.getByRole('button', { name: 'Cost of Installation Services' })
    await expect(option).toBeVisible({ timeout: 5_000 })
    await option.click()
    await expect(page.getByLabel('Category', { exact: true })).toHaveText(
      'Cost of Installation Services'
    )
  })

  test('Supplier field is searchable instead of a plain scroll list', async ({ page }) => {
    await gotoReady(page, '/accounting/expenses/new')
    await expect(page.getByRole('heading', { name: 'New Expense' })).toBeVisible({
      timeout: 10_000,
    })
    await pickFromCustomSelect(page, '— Select —', 'Supplier')

    const supplierField = page.getByLabel('Select supplier', { exact: true })
    await supplierField.click()
    const search = page.getByPlaceholder('Search categories…')
    await expect(search).toBeVisible({ timeout: 5_000 })

    // Popup options live in CategorySelect's own scrollable list, distinct
    // from every other button on the page (sidebar, header, etc.). Index 0 is
    // always the "— None —" clear row, so >1 means at least one real supplier.
    // Same guard supplier-vendor-merge-expenses-supplier.spec.ts uses: the
    // e2e database doesn't always carry supplier rows.
    const popupOptions = page.locator('.max-h-60 button')
    const optionCount = await popupOptions.count()
    test.skip(optionCount <= 1, 'No suppliers seeded — nothing to search')

    await search.fill('3E FURNITURE')
    await expect.poll(() => popupOptions.count(), { timeout: 5_000 }).toBe(1)
    await expect(popupOptions.first()).toContainText('3E FURNITURE')
    await popupOptions.first().click()
    await expect(supplierField).toContainText('3E FURNITURE')
  })
})
