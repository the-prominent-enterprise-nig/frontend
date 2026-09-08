import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Scenario 47 Part 2 — POS Sales Reports page (/pos/reports).
 *
 * Verifies the UI surface: both tabs render, the shared date-range control
 * and its presets drive the query, the filters are wired, and Export to Excel
 * actually downloads a real .xlsx. Exact figures/grouping correctness is
 * covered by the backend suite (backend/test/sales-reports.e2e-spec.ts),
 * which controls sale amounts via direct Prisma writes Playwright can't reach.
 *
 * Runs as Business Owner (the chromium project's stored auth state), so the
 * page's pos:reports:read guard passes.
 *
 * The seed deliberately strips demo POS data, so on a freshly reset e2e DB
 * there are no sales to export and the download assertion self-skips (with a
 * 'skipped-assertion' annotation rather than a silent pass). To exercise the
 * download for real, seed a dated sale first:
 *
 *   cd ../backend && set -a && source .env.test && set +a \
 *     && npx ts-node --project tsconfig.json --transpile-only \
 *        scripts/s47-e2e-fixture.ts            # --clean to remove it again
 */

test.describe('POS — Sales Reports (Scenario 47)', () => {
  test('renders both report tabs with the branch grouping by default', async ({ page }) => {
    await gotoReady(page, '/pos/reports')

    await expect(page.getByRole('heading', { name: 'Sales Reports' })).toBeVisible({
      timeout: 15_000,
    })

    await expect(page.getByRole('tab', { name: 'Sales per Branch' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(page.getByRole('tab', { name: 'Sales per Brand' })).toBeVisible()

    // Branch-first grouping — the client's own ordering for this report.
    await expect(page.getByRole('columnheader', { name: 'Branch' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Brand' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Category' })).toBeVisible()
  })

  test('switching to Sales per Brand re-orders the grouping columns', async ({ page }) => {
    await gotoReady(page, '/pos/reports')
    await expect(page.getByRole('heading', { name: 'Sales Reports' })).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole('tab', { name: 'Sales per Brand' }).click()
    await expect(page.getByRole('tab', { name: 'Sales per Brand' })).toHaveAttribute(
      'aria-selected',
      'true'
    )

    // Brand becomes the first grouping column, branch the last.
    const headers = page.getByRole('columnheader')
    await expect(headers.nth(0)).toHaveText('Brand')
    await expect(headers.nth(1)).toHaveText('Category')
    await expect(headers.nth(2)).toHaveText('Branch')
  })

  test('date-range presets update the from/to inputs', async ({ page }) => {
    await gotoReady(page, '/pos/reports')
    await expect(page.getByRole('heading', { name: 'Sales Reports' })).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole('button', { name: 'YTD' }).click()

    const from = page.locator('input[type="date"]').first()
    const today = new Date()
    await expect(from).toHaveValue(`${today.getFullYear()}-01-01`)

    await page.getByRole('button', { name: 'Today', exact: true }).click()
    const to = page.locator('input[type="date"]').nth(1)
    await expect(from).toHaveValue(await to.inputValue())
  })

  test('branch and brand filters are available', async ({ page }) => {
    await gotoReady(page, '/pos/reports')
    await expect(page.getByRole('heading', { name: 'Sales Reports' })).toBeVisible({
      timeout: 15_000,
    })

    const branch = page.getByLabel('Branch', { exact: true })
    await expect(branch).toBeVisible()
    // Populated from /branches, not a hardcoded list.
    await expect(branch.locator('option')).not.toHaveCount(1)

    await expect(page.getByLabel('Brand', { exact: true })).toBeVisible()
  })

  test('Export to Excel downloads a real .xlsx', async ({ page }) => {
    await gotoReady(page, '/pos/reports')
    await expect(page.getByRole('heading', { name: 'Sales Reports' })).toBeVisible({
      timeout: 15_000,
    })

    // Widen the range so there is something to export in a freshly seeded DB.
    await page.getByRole('button', { name: 'YTD' }).click()

    const exportButton = page.getByRole('button', { name: /Export to Excel/ })
    await expect(exportButton).toBeVisible()

    // Wait for the query to settle before reading the button's state — the
    // button is legitimately disabled while loading, and checking too early
    // silently skips the download this test exists to prove.
    await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 20_000 })

    // Disabled here means the range genuinely returned nothing, which is
    // correct behaviour rather than a failure — but say so out loud instead
    // of passing quietly, so an empty DB can't masquerade as a green test.
    if (await exportButton.isDisabled()) {
      await expect(page.getByText('No sales in this date range.')).toBeVisible()
      test.info().annotations.push({
        type: 'skipped-assertion',
        description: 'No sales in range — download path not exercised.',
      })
      return
    }

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
    await exportButton.click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/sales-per-branch.*\.xlsx$/)

    // Prove it's a real workbook, not an error page with an .xlsx name —
    // .xlsx is a zip, so it must start with the PK magic bytes.
    const path = await download.path()
    const { readFileSync } = await import('fs')
    expect(readFileSync(path).subarray(0, 2).toString()).toBe('PK')
  })
})
