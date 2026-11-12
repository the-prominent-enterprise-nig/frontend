import { test, expect } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// A Branch Manager's Reports page is their branch's. It used to offer the same
// "All Branches" picker as head office, and the trial balance, balance sheet,
// cash flow and AR figures behind it were the company's. The server now holds a
// branch user to their own branch; the page shows that instead of a picker.
// Head office keeps the picker.

const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL ?? 'technova.b1.manager@test.com'
const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'

test.describe('Branch Manager', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('P&L is fixed to their own branch, with no All Branches picker', async ({ page }) => {
    await loginAs(page, MANAGER_EMAIL, PASSWORD)
    await gotoReady(page, '/accounting/reports?tab=pnl')

    const branch = page.locator('div[aria-label="Branch"]')
    await expect(branch).toBeVisible({ timeout: 30_000 })
    const branchName = (await branch.innerText()).trim()
    expect(branchName.length).toBeGreaterThan(0)

    // No picker to widen the scope with.
    await expect(page.locator('select[aria-label="Branch"]')).toHaveCount(0)
    await expect(page.getByRole('option', { name: 'All Branches' })).toHaveCount(0)

    await expect(page.getByText(`Showing ${branchName} only.`)).toBeVisible()
    await page.screenshot({ path: 'test-results/reports-branch-manager-pnl.png', fullPage: true })
  })

  test('says so on the statements the server narrows, and not on AP Aging', async ({ page }) => {
    await loginAs(page, MANAGER_EMAIL, PASSWORD)

    await gotoReady(page, '/accounting/reports?tab=trial-balance')
    await expect(page.getByText(/Showing .+ only\./)).toBeVisible({ timeout: 30_000 })

    // AP bills carry no branch, so this tab is still the company's: no claim.
    await gotoReady(page, '/accounting/reports?tab=ap-aging')
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/Showing .+ only\./)).toHaveCount(0)
  })
})

test.describe('Business Owner', () => {
  test('keeps the All Branches picker', async ({ page }) => {
    await gotoReady(page, '/accounting/reports?tab=pnl')

    const picker = page.locator('select[aria-label="Branch"]')
    await expect(picker).toBeVisible({ timeout: 30_000 })
    await expect(picker.locator('option', { hasText: 'All Branches' })).toHaveCount(1)
    await expect(page.locator('div[aria-label="Branch"]')).toHaveCount(0)
    await expect(page.getByText(/Showing .+ only\./)).toHaveCount(0)
  })
})
