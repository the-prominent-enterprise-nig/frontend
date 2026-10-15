import { test, expect, type Page } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// Scenario 62 follow-on — Accounting's sidebar groups related items into hubs
// the way Inventory's does. Each hub's tabs are the original routes, so nothing
// that links to them had to change; the sidebar item stays lit across all of
// them, and the tab strip lights only the most specific tab.

const HUBS: {
  name: string
  entry: string
  tabs: { label: string; path: string }[]
  // A form under a tab, where the strip is not rendered but the item stays lit.
  formPath?: string
}[] = [
  {
    name: 'Books',
    entry: '/accounting/books',
    tabs: [
      { label: 'Journal Entries', path: '/accounting/journal-entries' },
      { label: 'General Ledger', path: '/accounting/general-ledger' },
      { label: 'Chart of Accounts', path: '/accounting/chart-of-accounts' },
      { label: 'Account Mapping', path: '/accounting/account-mapping' },
    ],
  },
  {
    name: 'Receivables',
    entry: '/accounting/receivables',
    tabs: [
      { label: 'AR Invoices', path: '/accounting/ar-invoices' },
      { label: 'Customers', path: '/accounting/customers' },
    ],
    formPath: '/accounting/ar-invoices/new',
  },
  {
    name: 'Expenses',
    entry: '/accounting/expenses-hub',
    tabs: [
      { label: 'Expenses', path: '/accounting/expenses' },
      // Nested under Expenses' path — must not light Expenses as well.
      { label: 'Recurring', path: '/accounting/expenses/recurring' },
      { label: 'Special Accounts', path: '/accounting/special-accounts' },
      { label: 'Employee Cash Loans', path: '/accounting/employee-cash-loans' },
    ],
    formPath: '/accounting/expenses/new',
  },
  {
    name: 'Cash & Banking',
    entry: '/accounting/cash-banking',
    tabs: [
      { label: 'Bank and Cash Accounts', path: '/accounting/bank-accounts' },
      { label: 'Undeposited Funds', path: '/accounting/cash-in-transit' },
      { label: 'Inter-Account Transfer', path: '/accounting/fund-transfers' },
      { label: 'Bank Reconciliation', path: '/accounting/bank-reconciliation' },
    ],
    formPath: '/accounting/fund-transfers/new',
  },
  {
    name: 'Payables',
    entry: '/accounting/payables',
    tabs: [
      { label: 'AP Invoices', path: '/accounting/ap-bills' },
      // Nested under AP Invoices' path — must not light AP Invoices as well.
      { label: 'Payments', path: '/accounting/ap-bills/payments' },
      { label: 'Receiving Reports', path: '/accounting/receiving-reports' },
    ],
    formPath: '/accounting/ap-bills/new',
  },
]

const sidebar = (page: Page) => page.locator('aside').first()
const tabStrip = (page: Page) => page.getByRole('navigation', { name: 'Module tabs' })
const LIT_ITEM = /bg-prominent-orange-200\/20/
const LIT_TAB = /border-prominent-orange-600/

for (const hub of HUBS) {
  test.describe(`Accounting — ${hub.name} hub`, () => {
    test(`the sidebar has one ${hub.name} item in place of its tabs`, async ({ page }) => {
      await gotoReady(page, '/accounting/journal-entries')

      await expect(sidebar(page).getByRole('link', { name: hub.name, exact: true })).toBeVisible({
        timeout: 15_000,
      })
      for (const { label } of hub.tabs.filter((tab) => tab.label !== hub.name)) {
        await expect(sidebar(page).getByRole('link', { name: label, exact: true })).toHaveCount(0)
      }
      // The rest of the Accounting nav is untouched.
      await expect(sidebar(page).getByRole('link', { name: 'Reports', exact: true })).toBeVisible()
      await expect(sidebar(page).getByRole('link', { name: 'Credit Memos' })).toBeVisible()
    })

    test('the item opens the first tab and the strip shows them all', async ({ page }) => {
      await gotoReady(page, '/accounting/journal-entries')
      await sidebar(page).getByRole('link', { name: hub.name, exact: true }).click()

      await expect(page).toHaveURL(new RegExp(`${hub.tabs[0].path}$`), { timeout: 15_000 })
      for (const { label } of hub.tabs) {
        await expect(tabStrip(page).getByRole('link', { name: label })).toBeVisible()
      }
    })

    test('the entry route redirects to the first tab', async ({ page }) => {
      await gotoReady(page, hub.entry)
      await expect(page).toHaveURL(new RegExp(`${hub.tabs[0].path}$`), { timeout: 15_000 })
    })

    test('each tab opens its own page, is the only one lit, and keeps the sidebar item lit', async ({
      page,
    }) => {
      await gotoReady(page, hub.tabs[0].path)

      for (const { label, path } of hub.tabs) {
        await tabStrip(page).getByRole('link', { name: label }).click()
        await expect(page).toHaveURL(new RegExp(`${path}$`), { timeout: 15_000 })

        // Dev mode compiles a route on its first visit; give the new page time.
        await expect(tabStrip(page).getByRole('link', { name: label })).toHaveClass(LIT_TAB, {
          timeout: 15_000,
        })
        await expect(tabStrip(page).locator('a.border-prominent-orange-600')).toHaveCount(1)
        await expect(sidebar(page).getByRole('link', { name: hub.name, exact: true })).toHaveClass(
          LIT_ITEM
        )
      }
    })

    test('a form under a tab still lights the sidebar item', async ({ page }) => {
      test.skip(!hub.formPath, 'no form route under this hub')
      await gotoReady(page, hub.formPath!)
      await expect(sidebar(page).getByRole('link', { name: hub.name, exact: true })).toHaveClass(
        LIT_ITEM,
        { timeout: 15_000 }
      )
    })
  })
}

test.describe('Accounting hubs — Accountant', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('the Accountant gets each hub and the tabs they hold permissions for', async ({ page }) => {
    await loginAs(
      page,
      process.env.E2E_ACCOUNTANT_EMAIL ?? 'technova.b1.accounting@test.com',
      process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'
    )

    for (const hub of HUBS) {
      await gotoReady(page, hub.entry)
      await expect(page).toHaveURL(new RegExp(`${hub.tabs[0].path}$`), { timeout: 15_000 })
      await expect(sidebar(page).getByRole('link', { name: hub.name, exact: true })).toBeVisible()
      for (const { label } of hub.tabs) {
        await expect(tabStrip(page).getByRole('link', { name: label })).toBeVisible()
      }
    }
  })
})
