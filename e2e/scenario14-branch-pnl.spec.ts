import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

/**
 * Scenario 14 (Accounting Month-End) Closing Gap 2 — Per-Branch P&L.
 *
 * Covers the UI side only — the actual branch-filtering math (does a
 * branchId param produce isolated, correct totals) is verified precisely
 * with isolated fixtures in the backend e2e spec
 * (scenario14-branch-pnl.e2e-spec.ts). This spec proves the wiring: the
 * Branch selector only shows on the P&L tab, picking a branch and running
 * the report shows a branch-scoped badge, and switching back to "All
 * Branches" clears it. No report-controller permission gate exists (see
 * reports.controller.ts — JwtAuthGuard only), so the default
 * Business-Owner storageState is fine here.
 */
test('P&L report has a branch selector that scopes the report', async ({ page }) => {
  await gotoReady(page, '/accounting/reports?tab=pnl')

  const branchSelect = page.getByLabel('Branch')
  await expect(branchSelect).toBeVisible({ timeout: 10_000 })
  await expect(branchSelect).toContainText('All Branches')
  await expect(branchSelect).toContainText('Bago')

  await branchSelect.selectOption({ label: 'Bago' })
  await clickStable(
    page.getByRole('button', { name: 'Run Report' }),
    page.getByText('Revenue', { exact: true })
  )

  // Badge only renders inside the P&L result card when data.branchId is
  // set — scoped by class rather than page.getByText('Bago') because
  // the still-present (if closed) <option>Bago</option> in the
  // selector itself would otherwise make a toHaveCount(0) check below a
  // false negative.
  const branchBadge = page.locator('span.bg-purple-50')
  await expect(branchBadge).toContainText('Bago', { timeout: 10_000 })
  await expect(page.getByText('Net Income')).toBeVisible()

  // Switch back to All Branches — the branch badge should disappear.
  await branchSelect.selectOption({ label: 'All Branches' })
  await page.getByRole('button', { name: 'Run Report' }).click()
  await expect(page.getByText('Net Income')).toBeVisible({ timeout: 10_000 })
  await expect(branchBadge).toHaveCount(0)

  // Other report tabs don't get a branch selector — this control is P&L-only.
  await page.getByRole('button', { name: 'Trial Balance' }).click()
  await expect(page.getByLabel('Branch')).toHaveCount(0)
})
