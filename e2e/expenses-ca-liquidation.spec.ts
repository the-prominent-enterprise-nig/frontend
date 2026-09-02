import { test, expect } from '@playwright/test'
import { gotoReady, pickFromCustomSelect } from './utils'

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
//
// Scenario 45 (2026-09-02) — the Payee tile this test starts from is
// labeled "Special Account" now, not "Other" (see expenses-category-quick-
// pick.spec.ts). Also fixed here: "Special Account type *"/"Which type is
// this closing out? *" are custom Selects (combobox/listbox/option roles,
// not native <select>s) — this file's own selectOption() calls had gone
// stale since that change (expenses-special-account-payee.spec.ts was
// already updated to pickFromCustomSelect at the time; this file wasn't),
// pre-existing breakage unrelated to Scenario 45, fixed here since it sits
// on the exact line already touched for the tile-label rename.
//
// Scenario 45 (2026-09-02) — Recipient is a plain text field now, so this
// no longer picks a real employee. The balance lookup keys on the typed
// name, which is exactly what makes the same constant below matter: the
// advance and both liquidations have to spell the recipient identically or
// the outstanding balance comes back 0.
const RECIPIENT = 'E2E Liquidation Recipient'
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
    await pickFromCustomSelect(page, '— Select —', 'Special Account')
    await pickFromCustomSelect(page, '— Select —', 'Employee Cash Advance')
    await page.getByLabel('Recipient', { exact: true }).fill(RECIPIENT)
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
    await pickFromCustomSelect(page, '— Select —', 'Special Account')
    await pickFromCustomSelect(page, '— Select —', 'CA-Liquidation')
    await pickFromCustomSelect(page, '— Select —', 'Employee Cash Advance')

    // Scenario 45: the balance is found by the typed name alone, so the
    // liquidation has to spell the recipient exactly as the advance did.
    await page.getByLabel('Recipient', { exact: true }).fill(RECIPIENT)
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
    await expect(liquidationRow).toContainText(RECIPIENT)

    // Confirm the remaining balance (1200) shows on a fresh liquidation attempt.
    await liquidationRow.locator('button[title="Record — posts to GL"]').click()
    await expect(liquidationRow).toContainText('RECORDED', { timeout: 10_000 })

    await page.getByRole('link', { name: 'New Expense' }).click()
    await page.waitForURL('**/accounting/expenses/new')
    await pickFromCustomSelect(page, '— Select —', 'Special Account')
    await pickFromCustomSelect(page, '— Select —', 'CA-Liquidation')
    await pickFromCustomSelect(page, '— Select —', 'Employee Cash Advance')
    await page.getByLabel('Recipient', { exact: true }).fill(RECIPIENT)
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
