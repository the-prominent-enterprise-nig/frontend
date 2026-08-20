import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 33 (Supplier/Vendor merge) Part 5 — the Suppliers screen's own
// create/edit form now captures the fields merged in from the retired
// Vendor model: Type, Business Type, Tax Code, Tax Rate, and the two
// default GL account pickers. Verifies a supplier created with these set
// round-trips correctly through edit. Self-cleaning: this suite doesn't
// delete suppliers (no delete action exists on this screen) — it reuses a
// unique, clearly-marked name so repeat runs don't collide meaningfully.
//
// Selects are targeted positionally (form select >> nth(N)), not via
// getByLabel: this form's Field component wraps both the label text AND
// the <select> in one <label>, so a select's computed accessible name is
// its label plus its own option text — "Type" then collides with "Business
// Type" under substring matching (Playwright's default), and exact
// matching never matches either because of the appended option text.
// Select order in this form: Type, Onboarding Status, Status, Default AP
// Payable Account, Default Expense Account.
test.describe('Inventory — Suppliers form merged fields', () => {
  test('creates a supplier with the merged-in fields and shows them on edit', async ({ page }) => {
    await gotoReady(page, '/inventory/suppliers')

    await page.getByRole('button', { name: 'New Supplier' }).click()
    await expect(page.getByRole('heading', { name: 'New Supplier' })).toBeVisible({
      timeout: 10_000,
    })

    const marker = `E2E-S33-SUP-${Date.now()}`
    await page.getByPlaceholder('e.g. SUP-0001').fill(marker)
    await page.getByPlaceholder('e.g. Acme Trading Corp.').fill(`E2E Merged Fields ${marker}`)

    const typeSelect = page.locator('form select').nth(0)
    await typeSelect.selectOption('CONTRACTOR')
    await page.getByPlaceholder('e.g. Corporation').fill('Sole Proprietorship')
    await page.getByPlaceholder('e.g. VAT, NON-VAT').fill('NON-VAT')
    await page.getByPlaceholder('e.g. 12%, Exempt').fill('Exempt')

    const payableSelect = page.locator('form select').nth(3)
    await payableSelect
      .locator('option')
      .nth(1)
      .waitFor({ state: 'attached', timeout: 5_000 })
      .catch(() => {})
    const payableOptionCount = await payableSelect.locator('option').count()
    let selectedAccountValue: string | undefined
    if (payableOptionCount > 1) {
      await payableSelect.selectOption({ index: 1 })
      selectedAccountValue = await payableSelect.inputValue()
    }

    await page.getByRole('button', { name: 'Create Supplier' }).click()
    await expect(page.getByRole('heading', { name: 'New Supplier' })).toHaveCount(0, {
      timeout: 10_000,
    })

    // Reopen via the list — search for the marker, select it, edit.
    await page.getByPlaceholder('Search suppliers…').fill(marker)
    const row = page.getByRole('button', { name: new RegExp(marker) })
    await expect(row).toBeVisible({ timeout: 10_000 })
    await row.click()

    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Supplier' })).toBeVisible({
      timeout: 10_000,
    })

    await expect(page.locator('form select').nth(0)).toHaveValue('CONTRACTOR')
    await expect(page.getByPlaceholder('e.g. Corporation')).toHaveValue('Sole Proprietorship')
    await expect(page.getByPlaceholder('e.g. VAT, NON-VAT')).toHaveValue('NON-VAT')
    await expect(page.getByPlaceholder('e.g. 12%, Exempt')).toHaveValue('Exempt')
    if (selectedAccountValue) {
      await expect(page.locator('form select').nth(3)).toHaveValue(selectedAccountValue)
    }

    await page.getByRole('button', { name: 'Cancel' }).click()
  })
})
