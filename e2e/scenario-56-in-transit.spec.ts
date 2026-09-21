import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 56 Part 3 — In Transit on the frontend:
//   - Serials status filter offers In Transit.
//   - Item Master gets a Stock column with the shared stock-state badge.
//   - Stock Balance rows use the same shared badge vocabulary.
// Dispatch → in_transit → re-transfer blocking is covered end-to-end by the
// backend spec stock-transfer-serial-in-transit.e2e-spec.ts; this one sticks
// to what the screens render. Read-only: creates nothing.

const STOCK_STATES = /In Stock|Low Stock|Fully Reserved|Out of Stock/

test.describe('Scenario 56 Part 3 — In Transit (frontend)', () => {
  test('Serials status filter offers In Transit', async ({ page }) => {
    await gotoReady(page, '/inventory/stock?tab=serials')
    await page.getByText('All statuses', { exact: true }).click()
    await expect(page.getByRole('option', { name: 'In Transit', exact: true })).toBeVisible({
      timeout: 20_000,
    })
  })

  test('Item Master shows a Stock column with stock-state badges', async ({ page }) => {
    await gotoReady(page, '/inventory/items')
    await expect(page.getByRole('columnheader', { name: 'Stock', exact: true })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('tbody tr').first()).toContainText(STOCK_STATES)
  })

  test('Stock Balance rows use the shared stock-state badge', async ({ page }) => {
    await gotoReady(page, '/inventory/stock?tab=balance')
    const table = page.getByRole('table').first()
    await expect(table.getByRole('row').nth(1)).toContainText(STOCK_STATES, { timeout: 20_000 })
    // The drawer's per-location rows used a separate Out/Critical/Low/Healthy
    // set before; that vocabulary is gone everywhere.
    await expect(page.getByText('Healthy', { exact: true })).toHaveCount(0)
  })
})
