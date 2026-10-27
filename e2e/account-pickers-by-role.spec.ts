import { test, expect, type Page } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// Scenario 74 review: roles without the full chart of accounts (GET /accounts
// carries every posted transaction) pick accounts from GET /accounts/options.
// Each screen below is opened as a role that uses it; its account picker must
// load accounts, and nothing may fall back to the full list and get refused.

const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'

type Screen = { role: string; email: string; name: string; open: (page: Page) => Promise<void> }

const visit = (path: string) => async (page: Page) => gotoReady(page, path)

const SCREENS: Screen[] = [
  {
    role: 'Payables Clerk',
    email: 'technova.al-payables-clerk@test.com',
    name: 'the Bill form',
    open: visit('/accounting/ap-bills/new'),
  },
  {
    role: 'Payables Clerk',
    email: 'technova.al-payables-clerk@test.com',
    name: 'Record Payment',
    open: visit('/accounting/ap-bills/payments/new'),
  },
  {
    role: 'Expense Clerk',
    email: 'technova.al-expense-clerk@test.com',
    name: 'the Expenses list account filter',
    open: visit('/accounting/expenses'),
  },
  {
    role: 'Expense Clerk',
    email: 'technova.al-expense-clerk@test.com',
    name: 'the Expense form',
    open: visit('/accounting/expenses/new'),
  },
  {
    role: 'Liquidation Clerk',
    email: 'technova.al-liquidation-clerk@test.com',
    name: 'New Special Account',
    open: async (page) => {
      await gotoReady(page, '/accounting/special-accounts')
      await page.getByRole('button', { name: /New Special Account/ }).click()
    },
  },
]

test.describe('Account pickers load for the roles that use them', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const screen of SCREENS) {
    test(`${screen.role}: ${screen.name}`, async ({ page }) => {
      await loginAs(page, screen.email, PASSWORD)
      const refused: string[] = []
      page.on('response', (res) => {
        if (/\/accounts$/.test(new URL(res.url()).pathname) && res.status() === 403) {
          refused.push(res.url())
        }
      })
      const options = page.waitForResponse(
        (res) => res.url().includes('/accounts/options') && res.request().method() === 'GET'
      )
      await screen.open(page)
      const res = await options
      expect(res.status()).toBe(200)
      expect(((await res.json()) as unknown[]).length).toBeGreaterThan(0)
      expect(refused).toEqual([])
    })
  }

  // The deposit slip's "Deposit from" list only opens with cash to deposit, so
  // this makes the slip editor's own request as the Deposit Clerk.
  test('Deposit Clerk: the deposit slip clearing accounts', async ({ page }) => {
    await loginAs(page, 'technova.al-deposit-clerk@test.com', PASSWORD)
    const res = await page.request.get('/api/accounts/options?search=1-01-04')
    expect(res.status()).toBe(200)
    const rows = (await res.json()) as { number: string }[]
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.number.includes('1-01-04'))).toBe(true)
  })
})
