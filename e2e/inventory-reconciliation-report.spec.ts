import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 29 INV-03 — the reconciliation report gets its own tab alongside
// Valuation/Turnover/Aging on /inventory/reports. Backend correctness (null-
// reference detection, missing-movement cross-checks per source, legitimate
// non-movement exclusions) is covered by
// backend/test/inventory-reconciliation-report.e2e-spec.ts with tightly
// controlled fixtures; this sticks to the UI surface — the tab loads, all
// four exception sections render, and the date-range filter refetches.
// Doesn't assert specific counts (real exception counts in the seed data
// are unpredictable, and ideally close to zero), just structural presence.

test.describe('Inventory — Reconciliation Report', () => {
  test('Reconciliation tab loads all four exception sections and the date filter refetches', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/reports')
    await page.getByRole('button', { name: 'Reconciliation', exact: true }).click()

    await expect(page.getByText('Movements with no source reference')).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('POS sales with no stock movement')).toBeVisible()
    await expect(page.getByText('Transfers with no stock movement')).toBeVisible()
    await expect(page.getByText('Adjustments with no stock movement')).toBeVisible()

    // Each section shows a count badge — confirms the report actually
    // returned data rather than being stuck loading/erroring.
    const countBadges = page.locator('span.rounded-full.px-2\\.5.py-1.text-xs.font-bold')
    await expect(countBadges).toHaveCount(4)

    // Date range filter — narrowing to a window with no real activity
    // should still render the same four sections, now as "No ... found"
    // empty states instead of erroring.
    await page.locator('#recon-start-date').fill('2020-01-01')
    await page.locator('#recon-end-date').fill('2020-01-02')
    await expect(page.getByText('No unreferenced movements found')).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('No unmatched sales found')).toBeVisible()
    await expect(page.getByText('No unmatched transfers found')).toBeVisible()
    await expect(page.getByText('No unmatched adjustments found')).toBeVisible()

    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(page.locator('#recon-start-date')).toHaveValue('')
    await expect(page.locator('#recon-end-date')).toHaveValue('')
  })
})
