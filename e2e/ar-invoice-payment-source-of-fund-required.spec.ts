import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 42 Part 4 — a system-generated Bank Reconciliation worksheet is
// only as trustworthy as "Source of Fund" being filled in for every
// non-cash AR collection. Non-destructive by design, same reasoning as
// purchasing-ap-cheque.spec.ts's first test: ARPayment has no delete/
// reverse endpoint, and this dialog's Amount defaults to the invoice's full
// outstanding balance, so an actual submit here would permanently pay off
// a real invoice in shared dev data. This only proves the client-side gate
// (required attribute, inline hint, blocked submit) — never submits.
test.describe('Accounting — AR Invoices Record Payment Source of Fund (Scenario 42 Part 4)', () => {
  test('Source of Fund becomes required only for a non-CASH method, and blocks submit until picked', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/ar-invoices')
    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })

    const payButton = page.getByRole('button', { name: 'Record payment' }).first()
    test.skip(
      (await payButton.count()) === 0,
      'No payable invoice in shared dev data to test against'
    )
    await payButton.click()

    await expect(page.getByRole('heading', { name: 'Record Payment' })).toBeVisible({
      timeout: 10_000,
    })

    const sourceOfFundSelect = page.getByLabel('Source of Fund', { exact: false })
    const methodSelect = page.getByLabel('Method')

    // Default method is CASH — Source of Fund stays optional.
    await expect(page.getByText('Source of Fund', { exact: true })).toBeVisible()
    await expect(sourceOfFundSelect).not.toHaveAttribute('required', '')

    await methodSelect.selectOption('CHECK')
    await expect(page.getByText('Source of Fund *')).toBeVisible({ timeout: 5_000 })
    await expect(sourceOfFundSelect).toHaveAttribute('required', '')
    await expect(
      page.getByText('Required for check payments, so this shows up in Bank Reconciliation.')
    ).toBeVisible()

    // Submitting without picking one is blocked client-side with an inline error.
    await page.getByRole('button', { name: 'Record Payment' }).click()
    await expect(page.getByText('Source of Fund is required for CHECK payments.')).toBeVisible({
      timeout: 5_000,
    })
    // Dialog is still open — nothing was submitted.
    await expect(page.getByRole('heading', { name: 'Record Payment' })).toBeVisible()

    // Back to CASH — the requirement (and its hint) disappears again.
    await methodSelect.selectOption('CASH')
    await expect(page.getByText('Source of Fund *')).toHaveCount(0)

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Record Payment' })).toHaveCount(0)
  })
})
