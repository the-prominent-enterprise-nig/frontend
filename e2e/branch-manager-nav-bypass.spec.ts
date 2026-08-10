import { test, expect } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// Scenario 22 Part 6 — Branch Manager's nav used to bypass permission
// checks in 3 separate places (canAccessModule, hasModuleAccess, and
// SideBar's own filterItem short-circuit), showing every item in a
// module regardless of what was actually granted. Now that Branch
// Manager's real grant was rebuilt (Part 11) to exclude enterprise-wide
// accounting infrastructure (fiscal periods, chart of accounts, currency,
// tax, general ledger, BIR export), the nav should correctly hide those
// links instead of showing them and 403ing on click.
test.use({ storageState: { cookies: [], origins: [] } })

const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL ?? 'technova.b1.manager@test.com'
const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'

test('Branch Manager nav shows branch-operational accounting links but hides excluded infrastructure ones', async ({
  page,
}) => {
  await loginAs(page, MANAGER_EMAIL, PASSWORD)
  await gotoReady(page, '/accounting/journal-entries')

  // Branch-operational — granted in Part 11, should be visible.
  await expect(page.getByRole('link', { name: 'Journal Entries' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'AR Invoices' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Budgets' })).toBeVisible()

  // Enterprise-wide infrastructure — deliberately excluded in Part 11,
  // should NOT be visible now that the nav-bypass is removed.
  await expect(page.getByRole('link', { name: 'Fiscal Periods' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Chart of Accounts' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Currencies' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Tax', exact: true })).toHaveCount(0)
})
