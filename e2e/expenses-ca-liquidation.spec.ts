import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 40 Part 2 — CA-Liquidation. Payee → Other → CA-Liquidation asks
// which Special Account type is being closed out, then the employee/party,
// shows their outstanding balance, and posts a partial or full repayment
// directly against the same account (reverse direction — credit, not
// debit). Self-cleaning: deletes both rows it creates.
//
// Scenario 40 Part 6 (2026-08-31) — Amount replaced the old header-level
// "Subtotal *" (now aria-label="Amount", per line), and the outstanding-
// balance hint moved from one shared line ("Outstanding balance: ") to a
// per-line hint ("Outstanding: ") shown right under each recipient's picker.
// Over-liquidating is now rejected by the server (the client no longer
// pre-checks it, since balances are tracked per recipient across possibly
// several lines) — same error text surfaces either way.
test.describe('Accounting — Expenses CA-Liquidation (Scenario 40 Part 2)', () => {
  test('records a partial liquidation against an Employee Cash Advance and shows the remaining balance', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/expenses')
    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })

    // Setup: create and record a 2000 Employee Cash Advance via the UI
    // (same flow Part 1 already proved works).
    const before1 = new Set(await page.locator('tbody tr td:first-child').allTextContents())
    await page.getByRole('link', { name: 'New Expense' }).click()
    await page.waitForURL('**/accounting/expenses/new')
    await page.getByRole('button', { name: 'Other', exact: true }).click()
    await page.getByLabel('Special Account type *').selectOption('EMPLOYEE_CASH_ADVANCE')
    const employeeInput = page.getByPlaceholder('Search employee by name or code…')
    await employeeInput.click()
    await employeeInput.fill('TEC')
    const employeeDropdown = page.locator('div.absolute.z-50')
    await expect(employeeDropdown).toBeVisible({ timeout: 10_000 })
    const firstResult = employeeDropdown.locator('button').first()
    const employeeLabel = (await firstResult.locator('span').first().textContent())?.trim()
    expect(employeeLabel).toBeTruthy()
    await firstResult.click()
    await page.getByLabel('Amount', { exact: true }).fill('2000')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForURL('**/accounting/expenses', { timeout: 10_000 })
    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    await expect
      .poll(async () => {
        const current = await page.locator('tbody tr td:first-child').allTextContents()
        return current.filter((n) => !before1.has(n)).length
      })
      .toBeGreaterThan(0)
    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    const advanceNumbers = (await page.locator('tbody tr td:first-child').allTextContents()).filter(
      (n) => !before1.has(n)
    )
    const advanceNumber = advanceNumbers[0]
    const advanceRow = page.locator('tbody tr', { hasText: advanceNumber })
    await advanceRow.locator('button[title="Record — posts to GL"]').click()
    await expect(advanceRow).toContainText('RECORDED', { timeout: 10_000 })

    // Now the actual Part 2 behavior: liquidate 800 of the 2000.
    const before2 = new Set(await page.locator('tbody tr td:first-child').allTextContents())
    await page.getByRole('link', { name: 'New Expense' }).click()
    await page.waitForURL('**/accounting/expenses/new')
    await page.getByRole('button', { name: 'Other', exact: true }).click()
    await page.getByLabel('Special Account type *').selectOption('CA_LIQUIDATION')

    const liquidatesTypeSelect = page.getByLabel('Which type is this closing out? *')
    await expect(liquidatesTypeSelect).toBeVisible({ timeout: 5_000 })
    await liquidatesTypeSelect.selectOption('EMPLOYEE_CASH_ADVANCE')

    const liqEmployeeInput = page.getByPlaceholder('Search employee by name or code…')
    await expect(liqEmployeeInput).toBeVisible({ timeout: 5_000 })
    await liqEmployeeInput.click()
    // Same deterministic ordering as the setup step above ([firstName,
    // lastName] asc) — searching "TEC" again and picking the first result
    // reliably lands on the same employee, without needing to know their name.
    await liqEmployeeInput.fill('TEC')
    const liqDropdown = page.locator('div.absolute.z-50')
    await expect(liqDropdown).toBeVisible({ timeout: 10_000 })
    await liqDropdown.locator('button').first().click()

    await expect(page.getByText(/Outstanding: /)).toContainText('2,000', { timeout: 10_000 })

    await page.getByLabel('Amount', { exact: true }).fill('800')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForURL('**/accounting/expenses', { timeout: 10_000 })

    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    await expect
      .poll(async () => {
        const current = await page.locator('tbody tr td:first-child').allTextContents()
        return current.filter((n) => !before2.has(n)).length
      })
      .toBeGreaterThan(0)
    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    const liquidationNumbers = (
      await page.locator('tbody tr td:first-child').allTextContents()
    ).filter((n) => !before2.has(n))
    const liquidationNumber = liquidationNumbers[0]
    const liquidationRow = page.locator('tbody tr', { hasText: liquidationNumber })
    await expect(liquidationRow).toContainText('Employee Cash Advance')
    await expect(liquidationRow).toContainText('(Liquidation)')
    if (employeeLabel) await expect(liquidationRow).toContainText(employeeLabel)

    // Confirm the remaining balance (1200) shows on a fresh liquidation attempt.
    await liquidationRow.locator('button[title="Record — posts to GL"]').click()
    await expect(liquidationRow).toContainText('RECORDED', { timeout: 10_000 })

    await page.getByRole('link', { name: 'New Expense' }).click()
    await page.waitForURL('**/accounting/expenses/new')
    await page.getByRole('button', { name: 'Other', exact: true }).click()
    await page.getByLabel('Special Account type *').selectOption('CA_LIQUIDATION')
    await page.getByLabel('Which type is this closing out? *').selectOption('EMPLOYEE_CASH_ADVANCE')
    const checkInput = page.getByPlaceholder('Search employee by name or code…')
    await checkInput.click()
    await checkInput.fill('TEC')
    await expect(page.locator('div.absolute.z-50')).toBeVisible({ timeout: 10_000 })
    await page.locator('div.absolute.z-50').locator('button').first().click()
    await expect(page.getByText(/Outstanding: /)).toContainText('1,200', { timeout: 10_000 })

    // Over-liquidating the remaining 1200 by asking for 5000 is rejected by the server.
    await page.getByLabel('Amount', { exact: true }).fill('5000')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText(/exceeds the outstanding balance/)).toBeVisible({ timeout: 10_000 })
    await page.getByRole('link', { name: 'Cancel' }).click()
    await page.waitForURL('**/accounting/expenses', { timeout: 10_000 })

    // Cleanup — both rows are RECORDED, so (same as this app's other
    // RECORDED-row fixtures) they can't be hard-deleted, only voided, which
    // reverses each journal entry and leaves the books balanced.
    page.once('dialog', (dialog) => dialog.accept())
    await liquidationRow.locator('button[title="Void — reverses journal entry"]').click()
    await expect(liquidationRow).toContainText('VOID', { timeout: 10_000 })
    page.once('dialog', (dialog) => dialog.accept())
    await advanceRow.locator('button[title="Void — reverses journal entry"]').click()
    await expect(advanceRow).toContainText('VOID', { timeout: 10_000 })
  })
})
