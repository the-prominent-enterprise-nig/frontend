import { test, expect } from '@playwright/test'
import { gotoReady, loginAs, clickStable } from './utils'

// Scenario 05 followup, Part 4 — Purchase Order screens cost-view. Real
// enforcement is server-side — see backend's
// inventory-po-cost-visibility.e2e-spec.ts — this spec only proves the UI
// reflects that boundary.
//
// Opts out of the shared Business Owner storageState (same reasoning as
// the other cost-visibility specs) since it needs to log in as a second,
// unprivileged role to exercise the negative case.
test.use({ storageState: { cookies: [], origins: [] } })

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'technova.owner@test.com'
const STOCK_CONTROLLER_EMAIL = process.env.E2E_STOCK_EMAIL ?? 'technova.b1.stock@test.com'
const PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'dev-prominent-enterprise-2026'

test.describe('Inventory — Purchase Order cost visibility (Scenario 05 followup, Part 4)', () => {
  test('Business Owner sees Unit Price/Line Total columns in PO Detail', async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/purchase-orders')

    await expect(page.getByRole('heading', { name: 'Purchase Orders' })).toBeVisible({
      timeout: 10_000,
    })
    // The row's onClick handler attaches during hydration, after the row
    // is already visually rendered — a raw .click() can land before React
    // has wired it up and silently no-op. clickStable retries until the
    // modal actually shows up (same race fillStable's own docs describe
    // for form fields, here for a row-level click handler instead).
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 })
    await clickStable(page.locator('tbody tr').first(), page.getByText('Line Items'))

    await expect(page.getByRole('columnheader', { name: 'Unit Price' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Line Total' })).toBeVisible()
    // "Subtotal" only appears in the modal's totals box, not the
    // background list — unambiguous unlike "Total", which also matches
    // the list's own column header sitting behind the modal overlay.
    await expect(page.getByText('Subtotal')).toBeVisible()
  })

  test('Stock Controller does not see Unit Price/Line Total columns, but still sees the Total', async ({
    page,
  }) => {
    await loginAs(page, STOCK_CONTROLLER_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/purchase-orders')

    await expect(page.getByRole('heading', { name: 'Purchase Orders' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 })
    await clickStable(page.locator('tbody tr').first(), page.getByText('Line Items'))

    await expect(page.getByRole('columnheader', { name: 'Unit Price' })).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: 'Line Total' })).toHaveCount(0)
    await expect(page.getByText('Subtotal')).toBeVisible()
  })
})
