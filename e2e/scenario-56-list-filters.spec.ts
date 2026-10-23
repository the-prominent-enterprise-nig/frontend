import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 56 Part 9 — the Operations + multi-select Branches filter is on
// the Ledger and Serial Numbers (same pair as Stock Balance), and Item Master
// has an Operations filter. Filter behaviour itself is covered server-side in
// backend/test/inventory-list-filters.e2e-spec.ts. Read-only.

test.describe('Scenario 56 Part 9 — list filters', () => {
  for (const tab of ['ledger', 'serials']) {
    test(`Stock ${tab} has Operations and Branches filters`, async ({ page }) => {
      await gotoReady(page, `/inventory/stock?tab=${tab}`)
      await expect(page.getByText('All Operations', { exact: true })).toBeVisible({
        timeout: 20_000,
      })
      await expect(page.getByText('All Branches', { exact: true })).toBeVisible()
    })
  }

  test('Item Master has an Operations filter', async ({ page }) => {
    await gotoReady(page, '/inventory/items')
    await expect(page.getByRole('combobox', { name: 'Operations' })).toBeVisible({
      timeout: 20_000,
    })
  })
})
