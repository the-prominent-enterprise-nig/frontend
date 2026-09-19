import { test, expect } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// Scenario 12 — Cash-in-Transit Monitor. Part 1 originally gave the Accountant
// pos:cash-in-transit:read and nothing else, and asserted the Deposit action
// stayed hidden.
//
// Scenario 53 reverses that on the client's own instruction — "POS cannot
// deposit, only accountant" — but WITHOUT giving the Accountant any pos:
// permission. The deposit moved to accounting:cash-in-transit:manage and
// Accounting got its own /accounting/cash-in-transit screen (the same
// component, a different permission), so the Accountant stays accounting-only.
// The Cashier keeps pos:cash-in-transit:read on the POS route and can no
// longer deposit from anywhere.
//
// Exercises the real role boundary, not just the UI, so it opts out of the
// shared Business Owner storageState every other spec inherits.
test.use({ storageState: { cookies: [], origins: [] } })

const ACCOUNTANT_EMAIL = process.env.E2E_ACCOUNTANT_EMAIL ?? 'technova.b1.accounting@test.com'
const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'technova.owner@test.com'
const CASHIER_EMAIL = process.env.E2E_CASHIER_EMAIL ?? 'technova.b1.cashier@test.com'
const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'

test.describe('Cash-in-Transit — deposit boundary (Scenario 53, Part 4)', () => {
  test('Accountant can open Cash-in-Transit and DOES get the Deposit action', async ({ page }) => {
    await loginAs(page, ACCOUNTANT_EMAIL, PASSWORD)
    await gotoReady(page, '/pos/cash-in-transit')

    await expect(page.getByText('Access Forbidden')).not.toBeVisible()
    await expect(page.getByRole('heading', { name: 'Cash-in-Transit' })).toBeVisible({
      timeout: 10_000,
    })

    // Scenario 53 — the Accountant is now the role that banks the cash, so
    // the deposit action must render. This assertion is the inverse of what
    // this test checked before, deliberately.
    await expect(page.getByRole('button', { name: /Deposit Selected to Bank/i })).toHaveCount(1)
  })

  test('Accountant has no POS access at all — the POS route stays forbidden', async ({ page }) => {
    await loginAs(page, ACCOUNTANT_EMAIL, PASSWORD)
    await page.goto('/pos/cash-in-transit')

    // The point of routing this through accounting:cash-in-transit:* rather
    // than granting pos:cash-in-transit:read — the Accountant reads the same
    // data from their own module without becoming a POS role.
    await expect(page).not.toHaveURL(/\/pos\/cash-in-transit$/, { timeout: 10_000 })
  })

  test('Cashier can open Cash-in-Transit but does NOT get the Deposit action', async ({ page }) => {
    await loginAs(page, CASHIER_EMAIL, PASSWORD)
    await gotoReady(page, '/pos/cash-in-transit')

    // "POS cashier can see the undeposited funds and cash in transit of the
    // branch only" — visible, so not a /403.
    await expect(page.getByText('Access Forbidden')).not.toBeVisible()
    await expect(page.getByRole('heading', { name: 'Cash-in-Transit' })).toBeVisible({
      timeout: 10_000,
    })

    // "POS cannot deposit, only accountant" — the whole point of the split.
    await expect(page.getByRole('button', { name: /Deposit Selected to Bank/i })).toHaveCount(0)
  })

  test('Accountant (branch-restricted) never sees the cross-branch monitor toggle', async ({
    page,
  }) => {
    await loginAs(page, ACCOUNTANT_EMAIL, PASSWORD)
    await gotoReady(page, '/accounting/cash-in-transit')
    await expect(page.getByRole('heading', { name: 'Cash-in-Transit' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('button', { name: /Monitor All Branches/i })).toHaveCount(0)
  })
})

test.describe('Cash-in-Transit — cross-branch monitor (Scenario 12, Part 3)', () => {
  test('Business Owner can open the monitor, sees every branch flagged correctly, and drills into one', async ({
    page,
  }) => {
    await loginAs(page, OWNER_EMAIL, PASSWORD)
    await gotoReady(page, '/pos/cash-in-transit')
    await expect(page.getByRole('heading', { name: 'Cash-in-Transit' })).toBeVisible({
      timeout: 10_000,
    })

    await page.getByRole('button', { name: /Monitor All Branches/i }).click()
    await expect(page.getByRole('heading', { name: 'Cash-in-Transit Monitor' })).toBeVisible({
      timeout: 10_000,
    })

    // Bago (formerly seeded/labeled "Manila HQ") has a real, persistent
    // outstanding session from earlier manual verification of this scenario —
    // flagged non-zero, not just present.
    const bagoRow = page.locator('tr', { hasText: 'Bago' })
    await expect(bagoRow).toBeVisible()
    await expect(bagoRow.getByText('Not at ₱0.00')).toBeVisible()

    await bagoRow.click()
    await expect(page.getByRole('heading', { name: /Bago — Cash-in-Transit/i })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('button', { name: /Back to monitor/i })).toBeVisible()

    await page.getByRole('button', { name: /Back to monitor/i }).click()
    await expect(page.getByRole('heading', { name: 'Cash-in-Transit Monitor' })).toBeVisible({
      timeout: 10_000,
    })
  })
})

test.describe('Cash-in-Transit — Excel export (Scenario 12, Part 5)', () => {
  test('Export to Excel downloads a CSV of the outstanding sessions view', async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, PASSWORD)
    await gotoReady(page, '/pos/cash-in-transit')
    await expect(page.getByRole('heading', { name: 'Cash-in-Transit' })).toBeVisible({
      timeout: 10_000,
    })

    // Bago's real outstanding session (from earlier manual verification)
    // guarantees this view has at least one row, so the button is enabled.
    await expect(page.locator('tr', { hasText: 'Bago' })).toBeVisible({ timeout: 10_000 })

    const exportButton = page.getByRole('button', { name: /Export to Excel/i })
    await expect(exportButton).toBeEnabled()

    const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()])
    expect(download.suggestedFilename()).toMatch(
      /^cash-in-transit-sessions-\d{4}-\d{2}-\d{2}\.csv$/
    )
  })

  test('Export to Excel is disabled when the current view has no rows', async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, PASSWORD)
    await gotoReady(page, '/pos/cash-in-transit')
    await page.getByRole('button', { name: /History/i }).click()
    await expect(page.getByRole('heading', { name: 'Cash-in-Transit History' })).toBeVisible({
      timeout: 10_000,
    })
    // Nothing has ever been cleared to a bank deposit company-wide yet.
    await expect(page.getByText('No Cash-in-Transit history yet.')).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('button', { name: /Export to Excel/i })).toBeDisabled()
  })
})
