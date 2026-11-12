/**
 * Docket #55 — an Accountant reads the amounts recorded for Electricity, Fuel and Repair
 * by clicking an entry on Accounting › Expenses › Recurring, instead of on separate
 * Drivers / Vehicles / Electricity tabs.
 *
 * Read-only: the page only READS existing expenses — you pick the account and payee on the
 * ordinary Expense form — so nothing here creates or edits an expense.
 *
 * UI contract only: the query (recorded entries on the entry's own account, newest first,
 * search, period, branch scope, totals over the whole set, the empty answer for an entry
 * with no account) is proven in
 * backend/src/accounting/expenses/expenses-recurring-type-amounts.spec.ts.
 *
 * Self-cleaning: never submits the Expense form, so nothing is created.
 */

import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

const RECURRING = '/accounting/expenses/recurring'

const list = (page: Page) => page.getByTestId('recurring-list')
const tabStrip = (page: Page) => page.getByRole('navigation', { name: 'Module tabs' })

/** Opens an entry by clicking its row, found by searching (the list pages ten to a page, so
 * an entry such as Installation is not on the first). A click made before the page has
 * hydrated does nothing, so it is retried until the entry page answers. */
async function openEntry(page: Page, name: string) {
  await gotoReady(page, RECURRING)
  // Search only once the list has loaded (which means the page has hydrated): text typed
  // before then is wiped when React takes over.
  await expect(list(page).getByText('Loading...')).toHaveCount(0, { timeout: 15_000 })
  const searchBox = page.getByLabel('Search recurring expenses')
  await searchBox.fill(name)
  await expect(searchBox).toHaveValue(name)
  const row = list(page).locator('tbody tr', { hasText: name })
  await expect(row).toBeVisible({ timeout: 15_000 })
  await expect(async () => {
    await row.click()
    await expect(page.getByTestId('recurring-entry-name')).toContainText(name, { timeout: 3_000 })
  }).toPass({ timeout: 30_000 })
}

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

test.describe('Expenses hub — no Drivers, Vehicles or Electricity tabs', () => {
  test('the strip has Recurring but none of the three', async ({ page }) => {
    await gotoReady(page, '/accounting/expenses')
    await expect(tabStrip(page).getByRole('link', { name: 'Recurring' })).toBeVisible({
      timeout: 15_000,
    })
    for (const name of ['Drivers', 'Vehicles', 'Electricity']) {
      await expect(tabStrip(page).getByRole('link', { name })).toHaveCount(0)
    }
  })
})

test.describe('Recurring › an entry', () => {
  test('Electricity bills opens its recorded amounts, read-only', async ({ page }) => {
    await openEntry(page, 'Electricity bills')
    await expect(page.getByText('6-03-040', { exact: false }).first()).toBeVisible()

    // Read-only: nothing here adds or files anything.
    await expect(page.getByRole('link', { name: /^Add /i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^(Add|New|Create) /i })).toHaveCount(0)

    // Searchable, with a period covered; with nothing recorded yet it says so, otherwise
    // the table carries the payee, branch and amount.
    await expect(page.getByLabel('Search recorded amounts')).toBeVisible()
    await expect(page.getByTestId('period-from')).toBeVisible()
    await expect(page.getByTestId('period-to')).toBeVisible()
    await expect(
      page.getByTestId('recurring-amounts-empty').or(page.getByTestId('recurring-amounts-table'))
    ).toBeVisible({ timeout: 15_000 })
    if (await page.getByTestId('recurring-amounts-table').isVisible()) {
      for (const name of ['Date', 'Expense No.', 'Payee', 'Branch', 'Description', 'Amount']) {
        await expect(page.getByRole('columnheader', { name })).toBeVisible()
      }
      // Electricity has no plate.
      await expect(page.getByRole('columnheader', { name: 'Plate No.' })).toHaveCount(0)
    }
    // Electricity is not a fleet entry: no roster links.
    await expect(page.getByRole('link', { name: 'Vehicles', exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Drivers', exact: true })).toHaveCount(0)
  })

  test('refuses a period that ends before it starts', async ({ page }) => {
    await openEntry(page, 'Electricity bills')
    // A field filled before the page has hydrated is wiped when React takes over, so the
    // fill is retried until the page answers.
    await expect(async () => {
      await page.getByTestId('period-from').fill('2026-10-31')
      await page.getByTestId('period-to').fill('2026-10-01')
      await expect(page.getByText('From must be on or before To.')).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 30_000 })
  })

  test('a filter that matches nothing says so, and Clear brings the list back', async ({
    page,
  }) => {
    await openEntry(page, 'Electricity bills')
    await expect(async () => {
      await page.getByLabel('Search recorded amounts').fill('zz-no-such-payee-zz')
      await expect(page.getByTestId('recurring-amounts-empty')).toContainText(
        'No amounts match those filters',
        { timeout: 6_000 }
      )
    }).toPass({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(page.getByLabel('Search recorded amounts')).toHaveValue('')
  })

  test('Fuel / lubricants links on to the fleet roster, and Back returns to Recurring', async ({
    page,
  }) => {
    await openEntry(page, 'Fuel / lubricants')
    await expect(page.getByText('6-04-010').first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Vehicles', exact: true })).toBeVisible()

    await page.getByRole('link', { name: 'Vehicles', exact: true }).click()
    await expect(page).toHaveURL(/\/accounting\/vehicles$/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Vehicles' })).toBeVisible()
    // No tab of its own, but the Expenses item stays lit in the sidebar.
    await expect(tabStrip(page).getByRole('link', { name: 'Vehicles' })).toHaveCount(0)
    await expect(
      page.locator('aside').first().getByRole('link', { name: 'Expenses', exact: true })
    ).toHaveClass(/bg-prominent-orange-200\/20/, { timeout: 15_000 })

    await page.getByRole('link', { name: 'Back to recurring expenses' }).click()
    await expect(page).toHaveURL(new RegExp(`${RECURRING}$`), { timeout: 15_000 })
  })

  test('an entry with no account says there is nothing to read until it has one', async ({
    page,
  }) => {
    await openEntry(page, 'Installation')
    await expect(page.getByTestId('recurring-no-account')).toContainText('has no account')
    await expect(page.getByLabel('Search recorded amounts')).toHaveCount(0)
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
