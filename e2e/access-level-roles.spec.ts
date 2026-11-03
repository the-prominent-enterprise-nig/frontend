import { test, expect, type Page } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// Scenario 74 — roles from the client's Access Levels sheet. The backend spec
// (backend/test/access-level-roles.e2e-spec.ts) proves the API allows and
// denies; this one proves the UI agrees: a tab or sidebar item shows only when
// its page will open, and a page the role can't use sends them to /403.
//
// Recurring, Special Accounts and the POS Product Catalog each got their own
// permission for this, so those are what it checks.
//
// Uses the technova.al-* accounts — one per Access Levels role on a local
// database that has run scripts/backfill-access-level-roles.ts.

const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'

const tabStrip = (page: Page) => page.getByRole('navigation', { name: 'Module tabs' })
const sidebar = (page: Page) => page.locator('aside').first()

const EXPENSES_TABS = ['Expenses', 'Recurring', 'Special Accounts', 'Employee Cash Loans']

type Persona = {
  role: string
  email: string
  /** Expenses hub: the tabs this role sees, in order. Empty: no hub at all. */
  expensesTabs: string[]
  /** Pages this role must be turned away from. */
  forbidden: string[]
  /** Pages this role must be able to open. */
  opens: string[]
}

const PERSONAS: Persona[] = [
  {
    role: 'Receptionist',
    email: 'technova.b1.al-receptionist@test.com',
    expensesTabs: ['Expenses'],
    forbidden: ['/accounting/expenses/recurring', '/accounting/special-accounts'],
    opens: ['/accounting/expenses'],
  },
  {
    role: 'Deposit Clerk',
    email: 'technova.al-deposit-clerk@test.com',
    expensesTabs: ['Expenses', 'Recurring'],
    forbidden: ['/accounting/special-accounts', '/accounting/employee-cash-loans'],
    opens: ['/accounting/expenses/recurring'],
  },
  {
    role: 'Bank Clerk',
    email: 'technova.al-bank-clerk@test.com',
    expensesTabs: ['Special Accounts'],
    forbidden: ['/accounting/expenses', '/accounting/expenses/recurring'],
    opens: ['/accounting/special-accounts'],
  },
  {
    role: 'Expense Clerk',
    email: 'technova.al-expense-clerk@test.com',
    expensesTabs: ['Expenses', 'Recurring', 'Employee Cash Loans'],
    forbidden: ['/accounting/special-accounts', '/pos/catalog'],
    opens: ['/accounting/employee-cash-loans'],
  },
  {
    role: 'Inventory Manager',
    email: 'technova.al-inventory-manager@test.com',
    expensesTabs: [],
    forbidden: ['/accounting/expenses', '/pos/sessions'],
    opens: ['/pos/catalog'],
  },
]

test.describe('Access Levels roles — the UI matches what each role may do', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const persona of PERSONAS) {
    test.describe(persona.role, () => {
      test.beforeEach(async ({ page }) => {
        await loginAs(page, persona.email, PASSWORD)
      })

      test('sees exactly its Expenses hub tabs', async ({ page }) => {
        if (persona.expensesTabs.length === 0) {
          await gotoReady(page, '/accounting/expenses-hub')
          await expect(page).toHaveURL(/\/403$/, { timeout: 15_000 })
          return
        }
        // The hub entry redirects to the first tab the role can open.
        await gotoReady(page, '/accounting/expenses-hub')
        const first = persona.expensesTabs[0]
        await expect(tabStrip(page).getByRole('link', { name: first })).toBeVisible({
          timeout: 15_000,
        })
        for (const label of EXPENSES_TABS) {
          await expect(tabStrip(page).getByRole('link', { name: label, exact: true })).toHaveCount(
            persona.expensesTabs.includes(label) ? 1 : 0
          )
        }
      })

      for (const path of persona.forbidden) {
        test(`is sent to /403 from ${path}`, async ({ page }) => {
          await gotoReady(page, path)
          await expect(page).toHaveURL(/\/403$/, { timeout: 15_000 })
        })
      }

      for (const path of persona.opens) {
        test(`opens ${path}`, async ({ page }) => {
          await gotoReady(page, path)
          await expect(page).toHaveURL(new RegExp(`${path}$`), { timeout: 15_000 })
        })
      }
    })
  }

  test('the Inventory Manager sees Product Catalog and nothing else under POS', async ({
    page,
  }) => {
    await loginAs(page, 'technova.al-inventory-manager@test.com', PASSWORD)
    await gotoReady(page, '/pos/catalog')
    await expect(sidebar(page).getByRole('link', { name: 'Product Catalog' })).toBeVisible({
      timeout: 15_000,
    })
    for (const label of ['Operations', 'Management', 'Collections', 'Daily Collection']) {
      await expect(sidebar(page).getByRole('link', { name: label, exact: true })).toHaveCount(0)
    }
  })
})
