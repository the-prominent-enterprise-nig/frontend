import { test, expect } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// Scenario 05 followup, Part 3 — Costing/Valuation + Item Revaluation
// cost-view. Real enforcement is server-side — see backend's
// inventory-costing-cost-visibility.e2e-spec.ts — this spec only proves
// the UI reflects that boundary.
//
// Opts out of the shared Business Owner storageState (same reasoning as
// the other cost-visibility specs) since it needs to log in as a second,
// unprivileged role to exercise the negative case.
test.use({ storageState: { cookies: [], origins: [] } })

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'technova.owner@test.com'
const STOCK_CONTROLLER_EMAIL = process.env.E2E_STOCK_EMAIL ?? 'technova.b1.stock@test.com'
const PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'dev-prominent-enterprise-2026'

test.describe('Inventory — Costing/Revaluation cost visibility (Scenario 05 followup, Part 3)', () => {
  test('Business Owner sees the Stock Valuation table on the Costing page', async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/costing')

    await expect(page.getByRole('heading', { name: 'Costing & COGS' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText("You don't have permission to view costing data")).toHaveCount(0)
    await expect(page.getByText('Total Inventory Value')).toBeVisible({ timeout: 10_000 })
  })

  test('Stock Controller sees a permission notice instead of the Stock Valuation table', async ({
    page,
  }) => {
    await loginAs(page, STOCK_CONTROLLER_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/costing')

    await expect(page.getByRole('heading', { name: 'Costing & COGS' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText("You don't have permission to view costing data")).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('Total Inventory Value')).toHaveCount(0)
  })

  test('Business Owner sees Old Cost/New Cost columns and New Revaluation on the Revaluation page', async ({
    page,
  }) => {
    await loginAs(page, OWNER_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/revaluation')

    await expect(page.getByRole('heading', { name: 'Inventory Revaluation' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('button', { name: 'New Revaluation' })).toBeVisible()
  })

  test('Stock Controller does not see New Cost column or New Revaluation on the Revaluation page', async ({
    page,
  }) => {
    await loginAs(page, STOCK_CONTROLLER_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/revaluation')

    await expect(page.getByRole('heading', { name: 'Inventory Revaluation' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('columnheader', { name: 'New Cost' })).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: 'Old Cost' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'New Revaluation' })).toHaveCount(0)
  })

  test('Stock Controller can still open Add Item / New Bundle (cost-view no longer blocks creation)', async ({
    page,
  }) => {
    await loginAs(page, STOCK_CONTROLLER_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/items')

    await expect(page.getByRole('columnheader', { name: 'Item' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Add Item' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'New Bundle' })).toBeVisible()

    await page.getByRole('button', { name: 'Add Item' }).click()
    await expect(page.getByRole('heading', { name: 'Add New Item' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('Cost Price (₱)')).toHaveCount(0)
  })
})
