import { test, expect } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// Scenario 05 followup — cost-view restriction expanded beyond Receiving to
// Item Master (and Costing/Valuation/Bundles/PO screens, covered by their
// own specs). Gated by inventory:cost:view (renamed from
// inventory:receive:cost-view), restricted to Business Owner/Accountant.
// Real enforcement is server-side — see items.service.ts's stripCostPrice
// calls and the "Cost visibility" coverage in backend e2e specs; this spec
// only proves the UI reflects that boundary.
//
// Opts out of the shared Business Owner storageState (same reasoning as
// inventory-receiving-cost-visibility.spec.ts) since it needs to log in as a
// second, unprivileged role to exercise the negative case.
test.use({ storageState: { cookies: [], origins: [] } })

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'technova.owner@test.com'
const STOCK_CONTROLLER_EMAIL = process.env.E2E_STOCK_EMAIL ?? 'technova.b1.stock@test.com'
const PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'dev-prominent-enterprise-2026'

test.describe('Inventory — Item Master cost visibility (Scenario 05 followup)', () => {
  test('Business Owner sees the Cost Price column and can open Add Item', async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/items')

    await expect(page.getByRole('columnheader', { name: 'Cost Price' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Item' })).toBeVisible()
  })

  test('Stock Controller does not see the Cost Price column, but can still open Add Item', async ({
    page,
  }) => {
    // Revised 2026-08-10 — creation is no longer blocked for a caller
    // without cost-view (costPrice is optional at the backend DTO level,
    // and blocking outright broke Scenario 16's item-master-governance
    // draft flow); the Cost Price field is hidden instead, same treatment
    // as Editing — see inventory-costing-revaluation-cost-visibility.spec.ts
    // for the Add Item modal's hidden-field assertion.
    await loginAs(page, STOCK_CONTROLLER_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/items')

    await expect(page.getByRole('columnheader', { name: 'Cost Price' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add Item' })).toBeVisible()
  })

  test('Stock Controller does not see the Cost Price field when editing an item', async ({
    page,
  }) => {
    await loginAs(page, STOCK_CONTROLLER_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/items')

    await page.getByTitle('More actions').first().click()
    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Item' })).toBeVisible({ timeout: 10_000 })

    await expect(page.getByText('Cost Price (₱)')).toHaveCount(0)
  })
})
