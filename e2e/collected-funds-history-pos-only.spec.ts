import { test, expect, type Page } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// Ticket #76 — the Cashier and the Branch Manager see Collected Funds History in
// POS, so it is not repeated for them under Accounting (Cash & Banking).
//
// Both roles still call the same /pos-deposits routes from POS, which Accounting's
// accounting:cash-in-transit:read opens. That read now comes with POS's Collections
// feature (a need, src/auth/access-map.ts) instead of a row of their own, and the
// tab strip and the Accounting route count a role's own rows only. The Accountant
// holds the row itself, so nothing changes for them.
//
// Exercises the real role boundary, so it opts out of the shared Business Owner
// storageState every other spec inherits. Read-only: nothing is created.
test.use({ storageState: { cookies: [], origins: [] } })

const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'
const CASHIER_EMAIL = process.env.E2E_CASHIER_EMAIL ?? 'technova.b1.cashier@test.com'
const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL ?? 'technova.b1.manager@test.com'
const ACCOUNTANT_EMAIL = process.env.E2E_ACCOUNTANT_EMAIL ?? 'technova.b1.accounting@test.com'

// Next dev compiles a route on its first hit, which can outlast the default 5s.
const NAVIGATED = { timeout: 20_000 }

const collectedFundsLink = (page: Page) =>
  page.getByRole('link', { name: 'Collected Funds History' })
const collectedFundsHeading = (page: Page) =>
  page.getByRole('heading', { name: 'Collected Funds History' })

test.describe('Collected Funds History — POS only for branch staff (Ticket #76)', () => {
  test('Branch Manager: no tab under Accounting, the route goes to POS, POS still shows it', async ({
    page,
  }) => {
    await loginAs(page, MANAGER_EMAIL, PASSWORD)

    // The Cash & Banking hub is still theirs (Bank and Cash Accounts), minus this tab.
    await gotoReady(page, '/accounting/cash-banking')
    await expect(page).toHaveURL('/accounting/bank-accounts', NAVIGATED)
    await expect(page.getByRole('link', { name: 'Bank Reconciliation' }).first()).toBeVisible()
    await expect(collectedFundsLink(page)).toHaveCount(0)

    // A typed or bookmarked Accounting address ends up on POS's screen.
    await gotoReady(page, '/accounting/cash-in-transit')
    await expect(page).toHaveURL('/pos/undeposited-funds', NAVIGATED)
    await expect(collectedFundsHeading(page)).toBeVisible(NAVIGATED)
    await expect(page.getByText('Access Forbidden')).not.toBeVisible()
  })

  test('Cashier: the Accounting route goes to POS, and POS still shows it', async ({ page }) => {
    await loginAs(page, CASHIER_EMAIL, PASSWORD)

    await gotoReady(page, '/accounting/cash-in-transit')
    await expect(page).toHaveURL('/pos/undeposited-funds', NAVIGATED)
    await expect(collectedFundsHeading(page)).toBeVisible(NAVIGATED)
    await expect(page.getByText('Access Forbidden')).not.toBeVisible()
  })

  test('Accountant: Collected Funds History stays under Accounting', async ({ page }) => {
    await loginAs(page, ACCOUNTANT_EMAIL, PASSWORD)

    await gotoReady(page, '/accounting/cash-banking')
    await expect(collectedFundsLink(page).first()).toBeVisible(NAVIGATED)

    await gotoReady(page, '/accounting/cash-in-transit')
    await expect(page).toHaveURL('/accounting/cash-in-transit', NAVIGATED)
    await expect(collectedFundsHeading(page)).toBeVisible(NAVIGATED)
  })
})
