import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// POS Sales Report — Margin visibility (Scenario 57, Part 2).
//
// Client request 2026-09-21: "margin per sale removed". The per-row Margin
// column goes; the Margin TOTAL stays in the stat row, because that summary
// figure is what a Branch Manager reads the report for and the ask was
// specifically about per-sale margin.
//
// Runs as Business Owner — Cashier cannot reach this page at all
// (pos:reports:read is excluded from that role by design), so there is no
// role dimension to assert here beyond the page loading.
test.describe('POS Sales Report — Margin', () => {
  test('shows the Margin total but no per-sale Margin column', async ({ page }) => {
    await gotoReady(page, '/pos/reports')

    // The summary tile survives.
    await expect(page.getByText('Margin', { exact: true }).first()).toBeVisible()

    // The table header must not carry it. Scoped to the table so the stat
    // tile above doesn't satisfy this by accident — the whole point is that
    // one stays and the other goes.
    const headerCells = page.locator('table thead th')
    await expect(headerCells.filter({ hasText: /^Margin$/ })).toHaveCount(0)

    // The neighbouring columns are still there, so a failure here means
    // "Margin was removed" rather than "the table failed to render".
    await expect(headerCells.filter({ hasText: /^Net Sales$/ })).toHaveCount(1)
    await expect(headerCells.filter({ hasText: /^Refunds$/ })).toHaveCount(1)
  })

  // Scenario 57 — the Branch and Brand filters were native <select>s, which
  // is unusable at 41 branches and 127 brands. Asserting the type-ahead is
  // present and actually filters, since a silently-empty options list is the
  // failure mode that matters.
  test('Branch and Brand filters are searchable, not native selects', async ({ page }) => {
    await gotoReady(page, '/pos/reports')

    await expect(page.locator('select[aria-label="Branch"]')).toHaveCount(0)
    await expect(page.locator('select[aria-label="Brand"]')).toHaveCount(0)

    const branch = page.getByPlaceholder('All branches')
    await expect(branch).toBeVisible()
    await branch.click()

    const options = page.getByTestId('searchable-select-option')
    await expect(options.first()).toBeVisible()
    const allBranches = await options.count()
    expect(allBranches).toBeGreaterThan(1)

    // Typing must narrow the list — the whole reason for the change.
    await branch.fill('Barotac')
    await expect(options.first()).toBeVisible()
    expect(await options.count()).toBeLessThan(allBranches)
  })
})
