import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 60 — the Caravan tab is one list: a row per item per caravan that
// opens onto its units (the old By Serial / By Item switch is gone). Runs as
// Business Owner (the only seeded storage state), who has no own branch, so
// the tab opens on every caravan in the company.
test.describe('Inventory — Caravan item rows', () => {
  test('opens on item rows with no view switch, and a row opens onto its units', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/serial-numbers')

    const caravanTab = page.getByRole('button', { name: 'Caravan', exact: true })
    await expect(caravanTab).toBeVisible({ timeout: 15_000 })
    await caravanTab.click()

    await expect(page.getByRole('button', { name: 'By Item' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'By Serial' })).toHaveCount(0)

    const emptyState = page.getByText(/Nothing currently (out on|at this) caravan/)
    const itemHeader = page.getByRole('columnheader', { name: 'Item' })
    await expect(emptyState.or(itemHeader)).toBeVisible({ timeout: 15_000 })
    if (await emptyState.isVisible()) return

    // Opening the first item row lists its units, each opening its history.
    const firstRow = page.locator('tbody tr').first()
    await firstRow.click()
    await expect(page.getByTestId('serial-link').first()).toBeVisible({ timeout: 15_000 })

    // And clicking it again folds it back.
    await firstRow.click()
    await expect(page.getByTestId('serial-link')).toHaveCount(0)
  })

  test('searching a serial opens the item it belongs to', async ({ page }) => {
    await gotoReady(page, '/inventory/serial-numbers')
    await page.getByRole('button', { name: 'Caravan', exact: true }).click()

    const itemHeader = page.getByRole('columnheader', { name: 'Item' })
    const emptyState = page.getByText(/Nothing currently (out on|at this) caravan/)
    await expect(emptyState.or(itemHeader)).toBeVisible({ timeout: 15_000 })
    if (await emptyState.isVisible()) return

    await page.locator('tbody tr').first().click()
    const serialLink = page.getByTestId('serial-link').first()
    await expect(serialLink).toBeVisible({ timeout: 15_000 })
    const serialNumber = (await serialLink.textContent())?.trim() ?? ''
    expect(serialNumber).not.toBe('')

    // Fold it, then search — the matching item is open without a click.
    await page.locator('tbody tr').first().click()
    await page.getByPlaceholder(/Search serial/).fill(serialNumber)
    await expect(page.getByTestId('serial-link').filter({ hasText: serialNumber })).toBeVisible({
      timeout: 15_000,
    })
  })

  test('leaving the Caravan tab returns the flat serial table', async ({ page }) => {
    await gotoReady(page, '/inventory/serial-numbers')
    await page.getByRole('button', { name: 'Caravan', exact: true }).click()
    await page.getByRole('button', { name: 'All Serials' }).click()
    await expect(page.getByRole('columnheader', { name: 'Serial #' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('columnheader', { name: 'Item' })).toHaveCount(0)
  })
})
