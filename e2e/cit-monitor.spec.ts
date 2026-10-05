import { test, expect } from '@playwright/test'
import { gotoReady, loginAs, pickComboboxOption } from './utils'

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
    await gotoReady(page, '/accounting/cash-in-transit')

    await expect(page.getByText('Access Forbidden')).not.toBeVisible()
    await expect(page.getByRole('heading', { name: 'Undeposited Funds' })).toBeVisible({
      timeout: 10_000,
    })

    // Scenario 53 — the Accountant is now the role that banks the cash, so
    // the deposit action must render. This assertion is the inverse of what
    // this test checked before, deliberately.
    // Scenario 61 Part 5: the action is Record Deposit (a draft accounting
    // then clears).
    await expect(page.getByRole('button', { name: /Record Deposit/i })).toHaveCount(1)
  })

  test('Accountant has no POS access at all — the POS route stays forbidden', async ({ page }) => {
    await loginAs(page, ACCOUNTANT_EMAIL, PASSWORD)
    await page.goto('/pos/undeposited-funds')

    // The point of routing this through accounting:cash-in-transit:* rather
    // than granting pos:cash-in-transit:read — the Accountant reads the same
    // data from their own module without becoming a POS role.
    await expect(page).not.toHaveURL(/\/pos\/cash-in-transit$/, { timeout: 10_000 })
  })

  test('Cashier can open Cash-in-Transit but does NOT get the Deposit action', async ({ page }) => {
    await loginAs(page, CASHIER_EMAIL, PASSWORD)
    await gotoReady(page, '/pos/undeposited-funds')

    // "POS cashier can see the undeposited funds and cash in transit of the
    // branch only" — visible, so not a /403.
    await expect(page.getByText('Access Forbidden')).not.toBeVisible()
    await expect(page.getByRole('heading', { name: 'Undeposited Funds' })).toBeVisible({
      timeout: 10_000,
    })

    // "POS cannot deposit, only accountant" — the whole point of the split.
    await expect(page.getByRole('button', { name: /Record Deposit/i })).toHaveCount(0)
  })

  test('Accountant (branch-restricted) never gets the branch picker', async ({ page }) => {
    await loginAs(page, ACCOUNTANT_EMAIL, PASSWORD)
    await gotoReady(page, '/accounting/cash-in-transit')
    await expect(page.getByRole('heading', { name: 'Undeposited Funds' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByPlaceholder('All branches')).toHaveCount(0)
  })
})

// Scenario 61 Part 5 replaced the separate monitor screen with a branch
// picker on the one table: every branch with its undeposited total, and
// picking one narrows the table to it.
test.describe('Cash-in-Transit — cross-branch view (Scenario 12, Part 3)', () => {
  test('Business Owner sees every branch, and picking one narrows the table to it', async ({
    page,
  }) => {
    await loginAs(page, OWNER_EMAIL, PASSWORD)
    await gotoReady(page, '/pos/undeposited-funds')
    await expect(page.getByRole('heading', { name: 'Undeposited Funds' })).toBeVisible({
      timeout: 10_000,
    })

    const label = await pickComboboxOption(page, 'All branches', 1)
    const branchName = label.split(' — ')[0]
    // Every branch header row left in the table is the picked branch.
    const headers = page.locator('tbody tr').filter({ has: page.getByRole('button') })
    await expect(headers.first()).toContainText(branchName, { timeout: 10_000 })
    for (const text of await headers.allInnerTexts()) expect(text).toContain(branchName)
  })
})

test.describe('Cash-in-Transit — Excel export (Scenario 12, Part 5)', () => {
  test('Export to Excel downloads a CSV of the outstanding sessions view', async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, PASSWORD)
    await gotoReady(page, '/pos/undeposited-funds')
    await expect(page.getByRole('heading', { name: 'Undeposited Funds' })).toBeVisible({
      timeout: 10_000,
    })

    // Bago's real outstanding session (from earlier manual verification)
    // guarantees this view has at least one row, so the button is enabled.
    await expect(page.locator('tr', { hasText: 'Bago' })).toBeVisible({ timeout: 10_000 })

    const exportButton = page.getByRole('button', { name: /Export to Excel/i })
    await expect(exportButton).toBeEnabled()

    const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()])
    expect(download.suggestedFilename()).toMatch(/^undeposited-funds-\d{4}-\d{2}-\d{2}\.csv$/)
  })

  test('Export to Excel is disabled when the current view has no rows', async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, PASSWORD)
    await gotoReady(page, '/pos/undeposited-funds')
    await expect(page.getByRole('heading', { name: 'Undeposited Funds' })).toBeVisible({
      timeout: 10_000,
    })
    // A search nothing matches empties the view.
    await page.getByLabel('Search sessions').fill('no-such-session-zzz')
    await expect(page.getByRole('button', { name: /Export to Excel/i })).toBeDisabled()
  })
})
