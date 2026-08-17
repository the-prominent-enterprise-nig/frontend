import { test, expect } from '@playwright/test'
import { gotoReady, loginAs, fillStable } from './utils'

// Scenario 05 followup, Part 2 — Bundles cost-view. Bundle Detail renders
// costPrice straight off the ItemSummary already fetched for the Item
// Master list, which Part 1's items.service.ts findAll() already strips
// server-side per inventory:cost:view — so this spec proves the inherited
// UI behavior rather than any new gating code (none was added for bundles
// specifically; see backend's inventory-bundle-cost-visibility.e2e-spec.ts).
//
// Opts out of the shared Business Owner storageState (same reasoning as
// inventory-item-master-cost-visibility.spec.ts) since it needs to log in
// as a second, unprivileged role to exercise the negative case.
test.use({ storageState: { cookies: [], origins: [] } })

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'technova.owner@test.com'
const STOCK_CONTROLLER_EMAIL = process.env.E2E_STOCK_EMAIL ?? 'technova.b1.stock@test.com'
const PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'dev-prominent-enterprise-2026'
const BUNDLE_SKU = 'TN-FURN-SET-001'

test.describe('Inventory — Bundle cost visibility (Scenario 05 followup, Part 2)', () => {
  test('Business Owner sees Cost Price in Bundle Detail', async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/items')

    // Wait for the unfiltered table to actually render before touching
    // search — Next dev-mode compiles this route on demand, and typing
    // mid-compile/mid-hydration can silently no-op or get wiped by a later
    // reconciliation (same class of race fillStable/gotoReady's own docs
    // describe elsewhere in this file).
    await expect(page.getByRole('columnheader', { name: 'Item' })).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 })

    await fillStable(page.getByPlaceholder('Search by name or SKU…'), BUNDLE_SKU)
    await expect(page.getByText(BUNDLE_SKU)).toBeVisible({ timeout: 10_000 })

    await page.getByTitle('More actions').first().click()
    await page.getByRole('button', { name: 'Components' }).click()
    await expect(page.getByRole('heading', { name: 'Bundle Detail' })).toBeVisible({
      timeout: 10_000,
    })

    await expect(page.getByText('Cost Price')).toBeVisible()
  })

  test('Stock Controller does not see Cost Price in Bundle Detail, but can still open New Bundle', async ({
    page,
  }) => {
    // Revised 2026-08-10 — creation is no longer blocked for a caller
    // without cost-view (costPrice is optional at the backend DTO level,
    // and blocking outright broke Scenario 16's item-master-governance
    // draft flow); the Cost Price field is hidden in CreateBundleModal
    // instead, same treatment as Item Master.
    await loginAs(page, STOCK_CONTROLLER_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/items')

    await expect(page.getByRole('button', { name: 'New Bundle' })).toBeVisible()

    await expect(page.getByRole('columnheader', { name: 'Item' })).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 })

    await fillStable(page.getByPlaceholder('Search by name or SKU…'), BUNDLE_SKU)
    await expect(page.getByText(BUNDLE_SKU)).toBeVisible({ timeout: 10_000 })

    await page.getByTitle('More actions').first().click()
    await page.getByRole('button', { name: 'Components' }).click()
    await expect(page.getByRole('heading', { name: 'Bundle Detail' })).toBeVisible({
      timeout: 10_000,
    })

    await expect(page.getByText('Cost Price')).toHaveCount(0)
  })
})
