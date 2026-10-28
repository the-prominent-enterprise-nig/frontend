import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Scenario 74, Modules and Sharing Plan, Steps 2, 4 and 5: roles read as
// "Module: access level", features carry their "Shared with" notes, and Add
// User reads the picked role back. The map comes from the backend
// (GET /permissions/access-map).

test.describe('Roles & Access — module map', () => {
  test('roles list reads "Module: access level"', async ({ page }) => {
    await gotoReady(page, '/settings/roles')

    const row = (name: RegExp) => page.getByRole('row', { name })
    await expect(
      row(/^Accountant/).getByText('Accounting: All access', { exact: true })
    ).toBeVisible()
    await expect(
      row(/^Expense Clerk/).getByText(/^Accounting: Partial \(\d+ of \d+ features\)$/)
    ).toBeVisible()
    // Protected steps kept out: Cashier's POS for branch staff, the Business
    // Owner's stock-adjustment steps for the Inventory Manager.
    await expect(
      row(/^Collector/).getByText('Point of Sale: All access *', { exact: true })
    ).toBeVisible()
    await expect(
      row(/^Inventory Manager/).getByText('Inventory: All access *', { exact: true })
    ).toBeVisible()
    // Inventory Manager's catalog access doesn't make POS "All access".
    await expect(row(/^Inventory Manager/).getByText(/^Point of Sale: Partial/)).toBeVisible()
    await expect(page.getByText(/: Mixed$/)).toHaveCount(0)
  })

  test('role editor groups resources by feature with Shared with notes', async ({ page }) => {
    await gotoReady(page, '/settings/roles')
    const row = page.getByRole('row', { name: /^Expense Clerk/ })
    await row.getByRole('button').last().click()
    await clickStable(
      page.getByRole('link', { name: 'Manage Access' }),
      page.getByRole('heading', { name: 'Module access' })
    )

    await page
      .getByRole('button', { name: /^Accounting/ })
      .first()
      .click()
    const customers = page.locator('[data-feature="accounting.customers"]')
    await expect(customers).toContainText('Shared with: CRM, POS')
    // Ownership answer A: shared by all three, no single owner.
    await expect(customers).toContainText('Customers owned by: Accounting, CRM, POS')
    await expect(page.getByText(/Owner pending/)).toHaveCount(0)
    const expenses = page.locator('[data-feature="accounting.expenses"]')
    await expect(expenses).toContainText('On')
    await expect(expenses).toContainText('Comes with, view only:')
    await expect(page.locator('[data-shared-access]')).toContainText('Files (upload and attach)')
  })

  test('Add User reads the picked role back', async ({ page }) => {
    await gotoReady(page, '/settings/users')
    await clickStable(
      page.getByRole('button', { name: '+ Add User' }),
      page.getByRole('heading', { name: 'Personal Info' })
    )
    await page.getByPlaceholder('Juan').fill('E2E')
    await page.getByPlaceholder('Dela Cruz').fill('Readback')
    await page.locator('input[type="date"]').fill('1995-01-01')
    await page.getByPlaceholder('user@example.com').fill(`e2e-readback-${Date.now()}@example.com`)
    await page.getByPlaceholder('09XXXXXXXXX').fill('09171234567')
    await clickStable(
      page.getByRole('button', { name: 'Next', exact: true }),
      page.getByRole('heading', { name: 'Work & Access' })
    )

    // Read back only; Send Invite is never pressed, so nothing is created.
    await page
      .getByRole('paragraph')
      .filter({ hasText: /^Finance Head$/ })
      .click()
    const readback = page.locator('[data-role-readback]')
    await expect(readback).toContainText('Accounting: All access')
    await expect(readback).toContainText('CRM: All access')
    await expect(readback).toContainText('POS: All access')
    await expect(readback).toContainText('Inventory: No access')
    await expect(readback).toContainText('Branch: Head Office (sees all branches)')
  })

  // The Expense form picks accounts from /accounts/options (no balances or
  // transactions) instead of the full chart, which carries every posted
  // transaction.
  test('the Expense form loads its account picker from /accounts/options', async ({ page }) => {
    const options = page.waitForResponse(
      (res) => res.url().includes('/accounts/options') && res.status() === 200
    )
    await gotoReady(page, '/accounting/expenses/new')
    const body = (await (await options).json()) as { number: string }[]
    expect(body.length).toBeGreaterThan(0)
    expect(body[0]).not.toHaveProperty('balance')
  })
})
