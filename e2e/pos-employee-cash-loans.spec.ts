import { test, expect } from '@playwright/test'
import { gotoReady, loginAs, fillStable, clickStable } from './utils'

// Scenario 52 (revised) — POS Employee Cash Loans UI: an amortizing loan
// with a computed schedule, no modal (3 real pages: list/new/detail).
// Backend financing/posting/search/list/detail is covered by
// backend/test/pos-employee-cash-loans.e2e-spec.ts; this spec exercises the
// actual screens: employee search, the live computed-terms preview, issuing
// a loan, its detail page + schedule, and the printable voucher.

const DEV_PASSWORD = 'dev-prominent-enterprise-2026'
const CASHIER_EMAIL = 'technova.b1.cashier@test.com'

test.describe('POS — Employee Cash Loans (amortizing)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('a Cashier searches an employee, previews financing terms, issues a loan, and sees its schedule', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await loginAs(page, CASHIER_EMAIL, DEV_PASSWORD)

    await gotoReady(page, '/pos/employee-cash-loans')
    await expect(page.getByRole('heading', { name: 'Employee Cash Loans' })).toBeVisible()

    // Longer timeout: this is the New Loan route's first-ever compile on a
    // freshly cold-started dev server (full db reset+reseed per run), which
    // can take well past clickStable's 10s default.
    await clickStable(
      page.getByRole('link', { name: 'New Loan' }),
      page.getByRole('heading', { name: 'New Employee Cash Loan' }),
      { timeout: 45_000 }
    )

    // The combobox renders as a closed button (its visible text is the
    // placeholder) until clicked — only then does the real, fillable
    // <input> mount. Selected by text, not role name: the surrounding
    // <label> (Field) gives the button an accessible name of "Employee *"
    // rather than its own placeholder text. clickStable retries the click
    // until the resulting input actually mounts (dev-mode hydration race).
    const employeeInput = page.getByPlaceholder('Search employee by name or code…')
    await clickStable(
      page.getByText('Search employee by name or code…', { exact: true }),
      employeeInput
    )
    await employeeInput.fill('a')
    const employeeDropdown = page.locator('div.fixed.z-100')
    await expect(employeeDropdown).toBeVisible({ timeout: 10_000 })
    const firstOption = employeeDropdown.locator('button').first()
    const employeeName = (await firstOption.innerText()).split('\n')[0].trim()
    await firstOption.click()

    // 50,000 principal / 12mo / 1% monthly matches the source sheet's own
    // worked example exactly: ₱6,000 total interest, ₱56,000 receivable.
    const numberInputs = page.locator('input[type="number"]')
    await fillStable(numberInputs.nth(0), '50000') // Loan Principal
    await fillStable(numberInputs.nth(1), '12') // Term (months)
    await fillStable(numberInputs.nth(2), '0.01') // Interest Rate / Loan Factor

    const dateInputs = page.locator('input[type="date"]')
    await dateInputs.nth(1).fill('2026-10-17') // First Deduction Date

    // Scenario 56 — Bank / Cash Account is now required for every
    // disbursement method (default here is Cash), not just Bank Transfer.
    const bankAccountTrigger = page.getByRole('button', { name: 'Select bank account' })
    const bankAccountInput = page.getByPlaceholder('Search bank accounts…')
    await clickStable(bankAccountTrigger, bankAccountInput)
    const bankAccountDropdown = page.locator('div.fixed.z-100')
    await expect(bankAccountDropdown).toBeVisible({ timeout: 10_000 })
    await bankAccountDropdown.locator('button').nth(1).click() // first real option, after the "— Select —" clear row

    // Live computed preview, mirroring the backend formula.
    await expect(page.getByText('₱6,000.00')).toBeVisible() // Total Interest
    await expect(page.getByText('₱56,000.00')).toBeVisible() // Total Amount Receivable

    await expect(async () => {
      await page.getByRole('button', { name: 'Create Cash Loan' }).click()
      await expect(page).toHaveURL(/\/pos\/employee-cash-loans\/[a-f0-9-]+$/, { timeout: 3_000 })
    }).toPass({ timeout: 15_000 })

    await expect(page.getByText(employeeName, { exact: false }).first()).toBeVisible()
    await expect(page.getByText('ACTIVE')).toBeVisible()
    // 12-row schedule rendered.
    await expect(page.locator('tbody tr')).toHaveCount(12)

    // Scenario 56, Part 2 — every field stays editable after submission.
    // A Reference/Voucher No.-only edit exercises the non-financial patch
    // path (no reverse-and-repost) — the financially-relevant path itself
    // is covered thoroughly by the backend e2e suite, not re-proven here.
    await clickStable(
      page.getByRole('link', { name: 'Edit' }),
      page.getByRole('heading', { name: 'Edit Employee Cash Loan' })
    )
    await expect(page.getByLabel('Loan Number *')).not.toHaveValue('')
    await fillStable(page.getByLabel('Reference / Voucher No.'), 'E2E-EDITED-REF')
    await expect(async () => {
      await page.getByRole('button', { name: 'Save Changes' }).click()
      await expect(page).toHaveURL(/\/pos\/employee-cash-loans\/[a-f0-9-]+$/, { timeout: 3_000 })
    }).toPass({ timeout: 15_000 })
    await expect(page.getByText('E2E-EDITED-REF')).toBeVisible()
    // Editing didn't touch financing — still the same schedule.
    await expect(page.locator('tbody tr')).toHaveCount(12)

    await page.getByRole('link', { name: 'Back to Employee Cash Loans' }).click()
    const row = page.locator('tr', { hasText: employeeName })
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row.getByText('₱56,000.00')).toBeVisible()
  })

  test('a user with no POS access cannot reach the list or new-loan page', async ({ page }) => {
    await loginAs(page, 'technova.accounting@test.com', DEV_PASSWORD)
    await gotoReady(page, '/pos/employee-cash-loans')
    await expect(page).toHaveURL(/\/403/)
    await gotoReady(page, '/pos/employee-cash-loans/new')
    await expect(page).toHaveURL(/\/403/)
  })
})
