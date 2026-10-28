import { test, expect, type Page } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// Access Levels Part 2: the client sheet's limits, as each role sees them.
// The server enforces them (backend test/access-level-limits.e2e-spec.ts);
// these check the screens agree.

const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'
const email = (role: string): string => `technova.al-${role}@test.com`
const branchEmail = (role: string): string => `technova.b1.al-${role}@test.com`

async function sidebarHrefs(page: Page): Promise<string[]> {
  await page.locator('aside a[href]').first().waitFor()
  return page
    .locator('aside a[href]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))
}

test.describe('Access Levels Part 2', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('Treasury Clerk: New Receipts offers acknowledgment only, no import', async ({ page }) => {
    await loginAs(page, email('treasury-clerk'), PASSWORD)
    await gotoReady(page, '/pos/collections/acknowledgement')
    await expect(page.getByRole('heading', { name: 'New Receipts' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Import receipts/ })).toHaveCount(0)
    await gotoReady(page, '/pos/collections/acknowledgement/new')
    await page.locator('input[placeholder="Select receipt type…"]').click()
    await expect(page.getByRole('button', { name: 'Acknowledgement', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Collection', exact: true })).toHaveCount(0)
  })

  test('Receptionist: no Cash & Banking; "Paid from" is their branch petty cash', async ({
    page,
  }) => {
    await loginAs(page, branchEmail('receptionist'), PASSWORD)
    await gotoReady(page, '/accounting/expenses')
    expect(await sidebarHrefs(page)).not.toContain('/accounting/cash-banking')
    const res = await page.request.get('/api/bank-accounts/options?purpose=expense-fund')
    expect(res.status()).toBe(200)
    const funds = (await res.json()) as { name: string }[]
    expect(funds.length).toBeGreaterThan(0)
    expect(funds.every((f) => /^Petty Cash Fund - /.test(f.name))).toBe(true)
  })

  test('Accounting opens on the first page a clerk can use, not the financial dashboard', async ({
    page,
  }) => {
    await loginAs(page, email('expense-clerk'), PASSWORD)
    await gotoReady(page, '/accounting')
    await expect(page).not.toHaveURL(/\/accounting$/)
    await expect(page).not.toHaveURL(/\/403/)
  })

  test('POS Reservations opens for a POS role, and is hidden from a partial one', async ({
    page,
  }) => {
    await loginAs(page, email('sales-support'), PASSWORD)
    await gotoReady(page, '/pos/reservations')
    await expect(page).not.toHaveURL(/\/403/)
    await page.context().clearCookies()
    await loginAs(page, email('deposit-clerk'), PASSWORD)
    await gotoReady(page, '/pos')
    expect(await sidebarHrefs(page)).not.toContain('/pos/reservations')
  })
})

// Business Owner (the default storage state): the Account limits page.
test("Settings: Expense Clerk's account limits show the sheet's two accounts", async ({ page }) => {
  const roles = (await (await page.request.get('/api/roles')).json()) as
    | { id: string; name: string }[]
    | { data: { id: string; name: string }[] }
  const list = Array.isArray(roles) ? roles : roles.data
  const role = list.find((r) => r.name === 'Expense Clerk')!
  await gotoReady(page, `/settings/roles/${role.id}`)
  await page.getByRole('link', { name: /Account limits/ }).click()
  await expect(page.getByRole('heading', { name: 'Expense Clerk' })).toBeVisible()
  await expect(page.getByText('Revolving Fund - Panay')).toBeVisible()
  await expect(page.getByText('Panay Special Fund - Construction')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save limits' })).toBeVisible()
})
