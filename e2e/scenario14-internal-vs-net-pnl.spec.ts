import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

/**
 * Scenario 14 (Accounting Month-End) Closing Gap 3 — Internal vs Net P&L
 * View.
 *
 * Covers the UI side only — the actual view-filtering math (does
 * view=internal correctly exclude adjusting-journal transactions) is
 * verified precisely with isolated fixtures in the backend e2e spec
 * (scenario14-internal-vs-net-pnl.e2e-spec.ts). This spec proves the
 * wiring: the View selector only shows on the P&L tab (alongside Branch),
 * defaults to Net, and switching to Internal shows the "Internal
 * (Unadjusted)" badge — switching back to Net clears it. No
 * report-controller permission gate exists (see reports.controller.ts —
 * JwtAuthGuard only), so the default Business-Owner storageState is fine.
 */
test('P&L report has a Net/Internal view toggle', async ({ page }) => {
  await gotoReady(page, '/accounting/reports?tab=pnl')

  const viewSelect = page.getByLabel('View')
  await expect(viewSelect).toBeVisible({ timeout: 10_000 })
  await expect(viewSelect).toHaveValue('net')

  await clickStable(
    page.getByRole('button', { name: 'Run Report' }),
    page.getByText('Revenue', { exact: true })
  )

  // Net is the default — no "Internal (Unadjusted)" badge should show.
  const internalBadge = page.locator('span.bg-amber-50', { hasText: 'Internal (Unadjusted)' })
  await expect(internalBadge).toHaveCount(0)

  await viewSelect.selectOption({ value: 'internal' })
  await page.getByRole('button', { name: 'Run Report' }).click()
  await expect(internalBadge).toBeVisible({ timeout: 10_000 })

  // Switch back to Net — badge disappears.
  await viewSelect.selectOption({ value: 'net' })
  await page.getByRole('button', { name: 'Run Report' }).click()
  await expect(page.getByText('Net Income')).toBeVisible({ timeout: 10_000 })
  await expect(internalBadge).toHaveCount(0)

  // Other report tabs don't get a View selector — this control is P&L-only.
  await page.getByRole('button', { name: 'Trial Balance' }).click()
  await expect(page.getByLabel('View')).toHaveCount(0)
})
