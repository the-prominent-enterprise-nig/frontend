import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

/**
 * Scenario 14 (Accounting Month-End) Closing Gap 4 — Cost-Center Report.
 *
 * Covers the UI side only — the actual grouping/aggregation math is
 * verified precisely with isolated fixtures in the backend e2e spec
 * (scenario14-cost-center-report.e2e-spec.ts). This spec proves the tab
 * exists, has its own date-range controls, and renders a table with the
 * expected columns once run. No report-controller permission gate exists
 * (see reports.controller.ts — JwtAuthGuard only), so the default
 * Business-Owner storageState is fine here.
 */
test('Reports has a Cost Center tab that renders a grouped table', async ({ page }) => {
  await gotoReady(page, '/accounting/reports?tab=cost-center')

  await expect(page.getByRole('button', { name: 'Cost Center' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'Cost Center' })).toHaveClass(/border-purple-600/)

  // Date range controls are present (needsDateRange includes cost-center).
  await expect(page.locator('label', { hasText: 'From' })).toBeVisible()
  await expect(page.locator('label', { hasText: 'To' })).toBeVisible()

  // Whether or not there's tagged data in the shared dev DB right now, the
  // report must render without erroring — either the empty state or the
  // grouped table's headers. Neither exists pre-click (the tab button's
  // "Cost Center" is a <button>, not a <columnheader>, so no collision),
  // so this doubles as clickStable's hydration-race guard.
  const emptyState = page.getByText('No cost-center-tagged records in this range.')
  const table = page.getByRole('columnheader', { name: 'Cost Center' })
  await clickStable(page.getByRole('button', { name: 'Run Report' }), emptyState.or(table))
  await expect(emptyState.or(table)).toBeVisible({ timeout: 10_000 })
})
