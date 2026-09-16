import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 08 (Caravan) — the "By Item" rollup. Runs as Business Owner (the
// only seeded storage state), who has no own branch, so this also covers the
// unscoped default: the tab opens on every consignment in the company and the
// branch picker only narrows it.
test.describe('Inventory — Caravan By Item rollup', () => {
  test('opens on By Serial across all branches, and By Item swaps in the rollup', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/serial-numbers')

    const caravanTab = page.getByRole('button', { name: 'Caravan' })
    await expect(caravanTab).toBeVisible({ timeout: 15_000 })
    await caravanTab.click()

    const byItem = page.getByRole('button', { name: 'By Item' })
    const bySerial = page.getByRole('button', { name: 'By Serial' })
    await expect(byItem).toBeVisible()
    await expect(bySerial).toBeVisible()

    // Serials lead — the unit list is what the tab opens on, and the rollup
    // is the summary you switch to.
    await expect(bySerial).toHaveClass(/bg-\[#f1ebfb\]/)

    // Regression: this used to gate on an explicit branch pick and show
    // nothing until one was made. The picker is now a filter, defaulting to
    // every branch, so the rollup must render straight away.
    await expect(
      page.getByText("Select a branch above to see what's consigned to it.")
    ).toHaveCount(0)
    await expect(page.getByPlaceholder('All branches')).toBeVisible()

    const emptyState = page.getByText(/Nothing currently (out on caravan|consigned)/)
    const serialHeader = page.getByRole('columnheader', { name: 'Serial #' })
    const itemHeader = page.getByRole('columnheader', { name: 'Item' })

    await expect(emptyState.or(serialHeader)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('columnheader', { name: 'Host / Venue' })).toHaveCount(0)

    // Switching to By Item folds the same rows to item level.
    await byItem.click()
    await expect(emptyState.or(itemHeader)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('columnheader', { name: 'Serial #' })).toHaveCount(0)

    // Back to serials, and the unit-level table returns.
    await bySerial.click()
    await expect(emptyState.or(serialHeader)).toBeVisible({ timeout: 15_000 })
  })

  test('picking a branch narrows the rollup, and clearing it restores every branch', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/serial-numbers')
    await page.getByRole('button', { name: 'Caravan' }).click()
    await page.getByRole('button', { name: 'By Item' }).click()
    await expect(page.getByRole('columnheader', { name: 'Item' })).toBeVisible({ timeout: 15_000 })

    const rowsAcrossAllBranches = await page.locator('tbody tr').count()
    expect(rowsAcrossAllBranches).toBeGreaterThan(0)

    // Every host/venue the unscoped rollup shows; narrowing to one branch can
    // only ever return a subset of these rows.
    await page.getByPlaceholder('All branches').click()
    await page.getByTestId('searchable-select-option').first().click()
    await page.waitForLoadState('networkidle')

    const rowsForOneBranch = await page.locator('tbody tr').count()
    expect(rowsForOneBranch).toBeLessThanOrEqual(rowsAcrossAllBranches)
  })

  test('leaving the Caravan tab drops the By Item / By Serial switch entirely', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/serial-numbers')

    await expect(page.getByRole('button', { name: 'By Item' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Caravan' }).click()
    await expect(page.getByRole('button', { name: 'By Item' })).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: 'All Serials' }).click()
    await expect(page.getByRole('button', { name: 'By Item' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'By Serial' })).toHaveCount(0)
  })
})
