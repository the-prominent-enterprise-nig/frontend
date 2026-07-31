import { test, expect } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// Scenario 12 — Cash-in-Transit Monitor. Part 1: the Accountant role gained
// pos:cash-in-transit:read this run (previously had none at all, hit /403).
// Exercises the real role boundary, not just the UI, so it opts out of the
// shared Business Owner storageState every other spec inherits.
test.use({ storageState: { cookies: [], origins: [] } })

const ACCOUNTANT_EMAIL = process.env.E2E_ACCOUNTANT_EMAIL ?? 'technova.b1.accounting@test.com'
const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'technova.owner@test.com'
const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'

test.describe('Cash-in-Transit — Accountant read access (Scenario 12, Part 1)', () => {
  test('Accountant can open Cash-in-Transit and sees their own branch, but no Deposit action', async ({
    page,
  }) => {
    await loginAs(page, ACCOUNTANT_EMAIL, PASSWORD)
    await gotoReady(page, '/pos/cash-in-transit')

    await expect(page.getByText('Access Forbidden')).not.toBeVisible()
    await expect(page.getByRole('heading', { name: 'Cash-in-Transit' })).toBeVisible({
      timeout: 10_000,
    })

    // Read-only: manage wasn't granted, so the deposit action must not render.
    await expect(page.getByRole('button', { name: /Deposit Selected to Bank/i })).toHaveCount(0)
  })

  test('Accountant (branch-restricted) never sees the cross-branch monitor toggle', async ({
    page,
  }) => {
    await loginAs(page, ACCOUNTANT_EMAIL, PASSWORD)
    await gotoReady(page, '/pos/cash-in-transit')
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

    // Manila HQ has a real, persistent outstanding session from earlier manual
    // verification of this scenario — flagged non-zero, not just present.
    const manilaRow = page.locator('tr', { hasText: 'Manila HQ' })
    await expect(manilaRow).toBeVisible()
    await expect(manilaRow.getByText('Not at ₱0.00')).toBeVisible()

    await manilaRow.click()
    await expect(page.getByRole('heading', { name: /Manila HQ — Cash-in-Transit/i })).toBeVisible({
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

    // Manila HQ's real outstanding session (from earlier manual verification)
    // guarantees this view has at least one row, so the button is enabled.
    await expect(page.locator('tr', { hasText: 'Manila HQ' })).toBeVisible({ timeout: 10_000 })

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
