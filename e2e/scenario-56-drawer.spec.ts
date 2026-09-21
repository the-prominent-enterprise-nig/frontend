import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 56 Part 4 — Item 360 drawer:
//   - One serial search across every location on the Stock tab.
//   - Movements carries an "Open transfers" section (transfers not yet in
//     the ledger) above its entries; there's no separate Transfers tab.
// Region scoping, the transfer itemId filter and serial region filter are
// covered server-side in stock-transfer-serial-in-transit.e2e-spec.ts.
// Read-only: creates nothing.

test.describe('Scenario 56 Part 4 — Item 360 drawer', () => {
  test('drawer has no separate Transfers tab and Movements loads', async ({ page }) => {
    await gotoReady(page, '/inventory/stock?tab=balance')
    const firstRow = page.getByRole('table').first().getByRole('row').nth(1)
    await expect(firstRow).toBeVisible({ timeout: 20_000 })
    await firstRow.click()

    const drawer = page.getByRole('dialog', { name: 'Item Details' })
    await expect(drawer.getByText('Stock by location')).toBeVisible({ timeout: 20_000 })
    await expect(drawer.getByRole('button', { name: 'Transfers', exact: true })).toHaveCount(0)

    await drawer.getByRole('button', { name: 'Movements', exact: true }).click()
    await expect(drawer.getByRole('combobox').first()).toBeVisible({ timeout: 20_000 })
  })
})

// Scenario 56 Part 5 — serial ages: RR age (first received) and branch age
// (arrived at its current location). Date maths is covered server-side.
test.describe('Scenario 56 Part 5 — serial ages', () => {
  test('Serial Numbers table shows an Age column with RR and branch ages', async ({ page }) => {
    await gotoReady(page, '/inventory/stock?tab=serials')
    await expect(page.getByRole('columnheader', { name: 'Age', exact: true })).toBeVisible({
      timeout: 20_000,
    })
    const firstRow = page.locator('tbody tr').first()
    await expect(firstRow).toContainText('RR')
    await expect(firstRow).toContainText('Branch')
  })
})
