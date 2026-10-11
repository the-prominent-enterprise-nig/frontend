/**
 * Recurring Expenses — an expense that comes round again (rent, electricity), saved
 * once with a schedule; a DRAFT is made on each due date and nothing posts until it
 * is recorded. The Expense form is reused to edit what it makes, so this covers the
 * UI contract: what the screens offer and hide.
 *
 * The rules that make a draft (a template that saves is one that generates; one draft
 * per due date; catch-up; a failed run is retried, not skipped; branch scoping) are
 * proven in backend/src/accounting/recurring-expenses/*.spec.ts.
 *
 * Never saves, so nothing is created.
 */

import { test, expect, type Page } from '@playwright/test'
import { gotoReady, pickFromCustomSelect } from './utils'

async function startNew(page: Page) {
  await gotoReady(page, '/accounting/recurring-expenses/new')
  await expect(page.getByTestId('recurring-schedule')).toBeVisible({ timeout: 15_000 })
}

test.describe('Recurring Expenses', () => {
  test('is in the sidebar and offers a new one and a run', async ({ page }) => {
    await gotoReady(page, '/accounting/recurring-expenses')
    await expect(page.getByRole('heading', { name: 'Recurring Expenses' })).toBeVisible()
    await expect(page.locator('a[href="/accounting/recurring-expenses"]').first()).toBeVisible()
    await expect(page.getByRole('link', { name: /New recurring expense/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Run due now' })).toBeVisible()
  })

  test("a quick-start from the client's list names the expense and picks the account", async ({
    page,
  }) => {
    await startNew(page)
    const chip = page.getByRole('button', { name: 'Electricity bills' })
    await expect(chip).toBeEnabled() // not until the chart of accounts has loaded
    await chip.click()
    await expect(page.locator('input[aria-label="Recurring expense name"]')).toHaveValue(
      'Electricity bills'
    )
    await expect(page.getByRole('combobox', { name: 'Monthly' })).toBeVisible()
    await expect(page.locator('[aria-label="Account"]').first()).toHaveValue(/Electricity/)
    // A bill from a supplier is a purchase: it starts on Input VAT.
    await expect(page.getByRole('combobox', { name: 'Input VAT' })).toBeVisible()
  })

  test('a recurring form leaves out what belongs to each occurrence', async ({ page }) => {
    await startNew(page)
    await expect(page.getByRole('button', { name: 'Rental monthly' })).toBeEnabled()
    await page.getByRole('button', { name: 'Rental monthly' }).click()
    // The date and "cleared" are the draft's, made on the due date.
    await expect(page.getByText('Cleared', { exact: true })).toBeHidden()
    // One payment, sized each time (total less withholding): no amount to type and
    // no splitting across methods.
    await expect(page.getByText('Add payment method')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Record', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible()
  })

  test('"as needed" has no schedule; a scheduled one needs its first due date', async ({
    page,
  }) => {
    await startNew(page)
    await expect(page.locator('input[aria-label="Due date"]')).toBeVisible()

    await pickFromCustomSelect(page, 'Monthly', 'As needed (no schedule)')
    await expect(page.locator('input[aria-label="Due date"]')).toHaveCount(0)
    await expect(page.getByText(/Create draft now/)).toBeVisible()

    await pickFromCustomSelect(page, 'As needed (no schedule)', 'Monthly')
    await page.locator('input[aria-label="Recurring expense name"]').fill('Test')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText(/Say when it is first due/)).toBeVisible()
  })

  test('Fuel from the list asks for the plate, like any fuel expense', async ({ page }) => {
    await startNew(page)
    const chip = page.getByRole('button', { name: 'Fuel / lubricants' })
    await expect(chip).toBeEnabled()
    await chip.click()
    await expect(page.locator('[data-testid="line-kind-fuel"]')).toBeVisible()
  })
})
