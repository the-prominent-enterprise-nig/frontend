/**
 * The Electricity tab (Accounting › Expenses › Electricity): the payments recorded
 * on Electricity / Light Expense, read back the way Vehicles reads back what was
 * spent on each plate. It only READS existing expenses — you pick Electricity as the
 * account and the provider (MERALCO…) as the payee on the ordinary Expense form, and
 * the payment shows here — so the form itself must ask for nothing extra.
 *
 * UI contract only: the query (recorded entries on 6-03-040 only, newest first, the
 * search, the period, the branch scope, totals over the whole set) is proven in
 * backend/src/accounting/expenses/expenses-electricity-payments.spec.ts.
 *
 * Self-cleaning: never submits the Expense form, so nothing is created.
 */

import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

async function pickPayee(page: Page, label: string) {
  const trigger = page
    .getByText(/^(— Select —|Customer|Supplier|Employee|Sales Agent|Other)$/)
    .first()
  const option = page.getByRole('option', { name: label, exact: true })
  await expect(async () => {
    await trigger.click()
    await expect(option).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
  await option.click()
}

async function pickAccount(page: Page, typed: string, full: string) {
  const account = page.locator('[aria-label="Account"]').first()
  await account.click()
  await account.fill('')
  await page.keyboard.type(typed)
  await page.getByText(full, { exact: true }).first().click()
}

test.use({ viewport: { width: 1440, height: 1100 } })

test.describe('Electricity tab', () => {
  test('is a tab beside Vehicles and opens a read-only list of payments', async ({ page }) => {
    await gotoReady(page, '/accounting/electricity')
    await expect(page.getByRole('heading', { name: 'Electricity' })).toBeVisible({
      timeout: 15_000,
    })
    const tabs = page.getByRole('navigation', { name: 'Module tabs' })
    await expect(tabs.getByRole('link', { name: 'Vehicles' })).toBeVisible()
    await expect(tabs.getByRole('link', { name: 'Electricity' })).toBeVisible()

    // Read-only: nothing here adds or edits anything.
    await expect(page.getByRole('link', { name: /^Add /i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^(Add|New|Create) /i })).toHaveCount(0)

    // Searchable, with a period covered; with no payments yet it says so, otherwise the
    // table carries the payee, branch and amount.
    await expect(page.getByLabel('Search electricity payments')).toBeVisible()
    await expect(page.getByTestId('period-from')).toBeVisible()
    await expect(page.getByTestId('period-to')).toBeVisible()
    await expect(
      page.getByTestId('electricity-empty').or(page.getByTestId('electricity-table'))
    ).toBeVisible({ timeout: 15_000 })
    if (await page.getByTestId('electricity-table').isVisible()) {
      for (const name of ['Date', 'Expense No.', 'Payee', 'Branch', 'Description', 'Amount']) {
        await expect(page.getByRole('columnheader', { name })).toBeVisible()
      }
    }
  })

  test('refuses a period that ends before it starts', async ({ page }) => {
    await gotoReady(page, '/accounting/electricity')
    // A field filled before the page has hydrated (a cold dev compile) is wiped when React
    // takes over, so the fill is retried until the page answers.
    await expect(async () => {
      await page.getByTestId('period-from').fill('2026-10-31')
      await page.getByTestId('period-to').fill('2026-10-01')
      await expect(page.getByText('From must be on or before To.')).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 30_000 })
  })

  test('a filter that matches nothing says so, and Clear brings the list back', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/electricity')
    await expect(async () => {
      await page.getByLabel('Search electricity payments').fill('zz-no-such-payee-zz')
      await expect(page.getByTestId('electricity-empty')).toContainText(
        'No electricity payments match those filters',
        { timeout: 6_000 }
      )
    }).toPass({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(page.getByLabel('Search electricity payments')).toHaveValue('')
  })
})

test.describe('Expense form — Electricity / Light Expense', () => {
  test('is the ordinary form: nothing extra is asked of an Electricity line', async ({ page }) => {
    await gotoReady(page, '/accounting/expenses/new')
    await expect(page.getByRole('heading', { name: 'New Expense' })).toBeVisible()

    await pickPayee(page, 'Other')
    await page.getByPlaceholder('e.g. NIG EMPLOYEES').fill('MERALCO')
    await pickAccount(page, 'Electricity', '6-03-040 — Electricity / Light Expense')

    // The line is a plain line: Account, Description, Division, Tax Code, Amount — no
    // provider, account number, plate, sale or agent columns, and no kind chip.
    const line = page.locator('[data-testid="expense-line"]').first()
    await expect(line).toBeVisible()
    await expect(line.getAttribute('data-kind')).resolves.toBe('')
    for (const extra of [
      'Provider *',
      'Account No. *',
      'Plate Number *',
      'Sales Invoice No. *',
      'Sales Agent *',
    ]) {
      await expect(page.getByText(extra)).toHaveCount(0)
    }
    await expect(page.getByTestId('expense-kind-chip')).toHaveCount(0)
  })
})
