import { test, expect } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// Scenario 05 (Receiving) followup — unit cost / NNDP cost is sensitive
// pricing data, restricted to Business Owner/Accountant via the new
// inventory:receive:cost-view permission. Stock Controller/Branch Manager
// can still receive stock, the cost fields just don't render for them (the
// real enforcement is server-side — see the backend e2e spec
// inventory-receiving-branch-serial-gl.e2e-spec.ts's "Cost visibility"
// describe block — this spec only proves the UI reflects that boundary).
//
// Opts out of the shared Business Owner storageState (same reasoning as
// inventory-stock-adjustment.spec.ts) since it needs to log in as a second,
// unprivileged role to exercise the negative case.
test.use({ storageState: { cookies: [], origins: [] } })

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'technova.owner@test.com'
const STOCK_CONTROLLER_EMAIL = process.env.E2E_STOCK_EMAIL ?? 'technova.b1.stock@test.com'
const PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'dev-prominent-enterprise-2026'

test.describe('Inventory — Receiving cost visibility (Scenario 05 followup)', () => {
  test('Business Owner sees Unit Cost and NNDP Cost fields on the receive form', async ({
    page,
  }) => {
    await loginAs(page, OWNER_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/operations?tab=receiving')

    await page.getByRole('button', { name: 'Receive Stock' }).click()
    await expect(page.getByRole('heading', { name: 'Receive Stock' })).toBeVisible({
      timeout: 10_000,
    })

    await expect(page.getByText('NNDP Cost')).toBeVisible()

    // The line-item table (and its Unit Cost column) only renders once a
    // line has been added — before that it's just an empty-state message.
    await page.getByRole('button', { name: 'Add Item' }).click()
    await expect(page.getByRole('columnheader', { name: 'Unit Cost' })).toBeVisible()
  })

  test('Stock Controller does not see Unit Cost or NNDP Cost fields on the receive form', async ({
    page,
  }) => {
    await loginAs(page, STOCK_CONTROLLER_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/operations?tab=receiving')

    await page.getByRole('button', { name: 'Receive Stock' }).click()
    await expect(page.getByRole('heading', { name: 'Receive Stock' })).toBeVisible({
      timeout: 10_000,
    })

    await expect(page.getByText('NNDP Cost')).toHaveCount(0)

    await page.getByRole('button', { name: 'Add Item' }).click()
    await expect(page.getByText('No items added yet.')).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: 'Unit Cost' })).toHaveCount(0)
  })
})
