import { test, expect } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// Scenario 74, the UAT round on the Access Levels roles: what each role sees
// in the sidebar and on Bank Reconciliation matches what it can open.

const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'
const email = (role: string): string => `technova.al-${role}@test.com`

async function sidebarHrefs(page: import('@playwright/test').Page): Promise<string[]> {
  await page.locator('aside a[href]').first().waitFor()
  return page
    .locator('aside a[href]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))
}

test.describe('Access Levels UAT fixes', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  // 1. POS PIN needs cashier-pin:verify, like its page. These roles hold a
  // corner of POS but no PIN, so Operations & Admin isn't offered at all.
  // Stock Clerk and Inventory Manager hold Sales Counter since the 2026-10-28
  // sheet, PIN included, so POS PIN (Operations & Admin) is theirs now.
  for (const role of ['deposit-clerk']) {
    test(`${role}: no Operations & Admin in POS`, async ({ page }) => {
      await loginAs(page, email(role), PASSWORD)
      await gotoReady(page, '/pos')
      expect(await sidebarHrefs(page)).not.toContain('/pos/admin')
    })
  }

  // 2. Books and Expenses show on Accounting's own permissions only.
  for (const role of ['sales-support', 'sales-admin', 'aircon-staff']) {
    test(`${role}: no Books or Expenses in the sidebar`, async ({ page }) => {
      await loginAs(page, email(role), PASSWORD)
      await gotoReady(page, '/accounting/account-mapping')
      const hrefs = await sidebarHrefs(page)
      expect(hrefs).not.toContain('/accounting/books')
      expect(hrefs).not.toContain('/accounting/expenses-hub')
    })
  }

  test('aircon-clerk still has Expenses', async ({ page }) => {
    await loginAs(page, email('aircon-clerk'), PASSWORD)
    await gotoReady(page, '/accounting/expenses')
    expect(await sidebarHrefs(page)).toContain('/accounting/expenses-hub')
  })

  // 4. Reconciling needs bank-accounts:reconcile; reading doesn't offer it.
  for (const role of ['expense-clerk', 'payables-clerk']) {
    test(`${role}: Bank Reconciliation is a list, no New Reconciliation`, async ({ page }) => {
      await loginAs(page, email(role), PASSWORD)
      await gotoReady(page, '/accounting/bank-reconciliation')
      await expect(page.getByRole('heading', { name: 'Bank Reconciliation' })).toBeVisible()
      await expect(page.getByRole('link', { name: /New Reconciliation/ })).toHaveCount(0)
      await expect(page.getByRole('link', { name: /Unidentified Credit/ })).toHaveCount(0)
      await expect(page.getByRole('link', { name: /Adjusting Entry/ })).toHaveCount(0)
    })
  }

  test('finance-head still starts a reconciliation', async ({ page }) => {
    await loginAs(page, email('finance-head'), PASSWORD)
    await gotoReady(page, '/accounting/bank-reconciliation')
    await expect(page.getByRole('link', { name: /New Reconciliation/ })).toBeVisible()
  })
})

// 6. The row menu floats over the table, so a one-row search result doesn't
// clip it.
test('Users: the ⋯ menu on a single search result is fully clickable', async ({ page }) => {
  await gotoReady(page, '/settings/users?status=active&search=technova.al-finance-head')
  const menu = page.getByRole('button', { name: 'More actions' }).first()
  await menu.waitFor()
  await menu.click()
  const del = page.getByRole('button', { name: 'Delete', exact: true })
  await expect(del).toBeInViewport()
  await del.click()
  await expect(page.getByRole('heading', { name: 'Delete user?' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
})
