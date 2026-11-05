import { test, expect } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// INV-64 — stock adjustments. Since Scenario 87 they come only from a
// Physical Inventory's Submit Count (the manual Create Adjustment tab and
// New adjustment modal were removed), so what's left to check here is the
// Counting hub's access gate. The approval chain is covered by
// inventory-stock-adjustment-approval-chain.spec.ts (adjustments created via
// the API), and Submit Count's adjustment by the backend count specs.
// Opts out of the shared Business Owner storageState to test a real role.
test.use({ storageState: { cookies: [], origins: [] } })

// Marketing Manager, not Cashier — Cashier legitimately holds
// inventory:serial:read (for looking up a unit at checkout), which is one
// of the Counting hub's own canAny() access-gate permissions, so a Cashier
// can now reach /inventory/counting. Marketing Manager holds none of the
// hub's permissions, so it's the one that actually still gets denied.
const NO_ACCESS_EMAIL = process.env.E2E_MARKETING_EMAIL ?? 'technova.b1.crm@test.com'
const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'

test.describe('Inventory — Stock Adjustments (INV-64)', () => {
  test('user without inventory:stock:adjust cannot reach Counting', async ({ page }) => {
    await loginAs(page, NO_ACCESS_EMAIL, PASSWORD)
    // The bare hub now redirects to Stock Report (Scenario 87); a tab URL
    // still exercises the Counting hub's own gate.
    await gotoReady(page, '/inventory/counting?tab=adjustments')
    await expect(page.getByText('Access Forbidden')).toBeVisible({ timeout: 10_000 })
  })
})
