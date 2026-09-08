import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Scenario 47 Part 3 — Expenses per Branch.
 *
 * The expense form deliberately has no Branch field: branch is stamped
 * server-side from the recording user's own session, so asking for it would
 * only be a second place to get it wrong. This covers the Reports tab and its
 * .xlsx export; grouping and branch-scoping correctness live in the backend
 * suite (backend/test/expenses-by-branch.e2e-spec.ts).
 *
 * Runs as Business Owner (the chromium project's stored auth state).
 */

test.describe('Accounting — Expenses per Branch (Scenario 47)', () => {
  test('the expense form has no Branch field — the server stamps it', async ({ page }) => {
    await gotoReady(page, '/accounting/expenses/new')
    await expect(page.getByRole('button', { name: /Save|Create/ }).first()).toBeVisible({
      timeout: 15_000,
    })

    // Branch is captured from the recording user's own session, never asked
    // for on the form (developer decision 2026-09-08).
    await expect(page.locator('label').filter({ hasText: /^Branch/ })).toHaveCount(0)
  })

  test('the Reports hub has an Expenses tab with a date range and branch filter', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/reports?tab=expenses')

    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({
      timeout: 15_000,
    })

    // Deep-linkable, same ?tab= convention the hub already uses.
    await expect(page.getByRole('button', { name: 'Expenses', exact: true })).toBeVisible()

    // This tab needs both a range and a branch — the P&L-only "View" select
    // must not follow the branch picker onto it.
    await expect(page.locator('input[type="date"]').first()).toBeVisible()
    await expect(page.getByLabel('Branch', { exact: true })).toBeVisible()
    await expect(page.getByLabel('View', { exact: true })).toHaveCount(0)
  })

  test('running the report renders the branch/category table', async ({ page }) => {
    await gotoReady(page, '/accounting/reports?tab=expenses')
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole('button', { name: /Run Report/ }).click()

    await expect(page.getByRole('columnheader', { name: 'Branch' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('columnheader', { name: 'Expense Category' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Total' })).toBeVisible()
  })

  test('Export to Excel downloads a real .xlsx', async ({ page }) => {
    await gotoReady(page, '/accounting/reports?tab=expenses')
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole('button', { name: /Run Report/ }).click()
    await expect(page.getByRole('columnheader', { name: 'Branch' })).toBeVisible({
      timeout: 20_000,
    })

    const exportButton = page.getByRole('button', { name: /Export to Excel/ })
    await expect(exportButton).toBeVisible()

    // Disabled means the range genuinely returned nothing — correct, but say
    // so rather than passing quietly, so an empty DB can't look green.
    if (await exportButton.isDisabled()) {
      await expect(page.getByText('No recorded expenses in this date range.')).toBeVisible()
      test.info().annotations.push({
        type: 'skipped-assertion',
        description: 'No recorded expenses in range — download path not exercised.',
      })
      return
    }

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
    await exportButton.click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/expenses-per-branch.*\.xlsx$/)

    const path = await download.path()
    const { readFileSync } = await import('fs')
    expect(readFileSync(path).subarray(0, 2).toString()).toBe('PK')
  })
})
