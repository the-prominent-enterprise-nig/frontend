import { test, expect, type Page } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// Receiving moved to the Stock hub: /inventory/operations?tab=receiving is
// gone and the entry point is the Receiving Reports tab's "New Receipt"
// button, which opens the same ReceiveStockModal (heading: "Receive Stock").

// Scenario 05 (Receiving) followup — unit cost / net delivered cost (NNDP,
// `nndpCost` on the wire) is sensitive
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

const ITEM_SEARCH_PLACEHOLDER = 'Scan or search an item to add a line…'

// Lines are added by picking from the catalogue search rather than by an
// "Add Item" button that drops an empty row — SearchCombobox
// (src/components/ui/SearchCombobox.tsx) renders a <button> while closed and
// portals its dropdown to document.body as a `fixed z-100` panel, so the pick
// is: click the button, type, choose from the portal.
async function openReceiveForm(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'New Receipt' }).click()
  await expect(page.getByRole('heading', { name: 'Receive Stock' })).toBeVisible({
    timeout: 10_000,
  })
}

async function addFirstItem(page: Page): Promise<void> {
  await page.getByRole('button', { name: ITEM_SEARCH_PLACEHOLDER }).click()
  await page.getByPlaceholder(ITEM_SEARCH_PLACEHOLDER).fill('a')
  const dropdown = page.locator('div.fixed.z-100')
  await expect(dropdown).toBeVisible({ timeout: 10_000 })
  const option = dropdown.locator('button').first()
  await expect(option).toBeVisible({ timeout: 10_000 })
  await option.click()
  await expect(page.getByText('No items added yet.')).toHaveCount(0)
  // The line's pricing sits in its details drawer, so that is where both the
  // presence and the absence of Unit cost have to be judged.
  await page.getByRole('button', { name: 'Details' }).first().click()
}

test.describe('Inventory — Receiving cost visibility (Scenario 05 followup)', () => {
  test('Business Owner sees Unit Cost and Net Delivered Cost fields on the receive form', async ({
    page,
  }) => {
    await loginAs(page, OWNER_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/stock?tab=reports')

    await openReceiveForm(page)
    await expect(page.getByText('Net Delivered Cost')).toBeVisible()
    // Receipt totals are cost data too, and only render for this role.
    await expect(page.getByText('Payable to supplier')).toBeVisible()

    await addFirstItem(page)
    await expect(page.getByLabel('Unit cost')).toBeVisible()
  })

  test('Stock Controller does not see Unit Cost or Net Delivered Cost on the receive form', async ({
    page,
  }) => {
    await loginAs(page, STOCK_CONTROLLER_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/stock?tab=reports')

    await openReceiveForm(page)
    await expect(page.getByText('Net Delivered Cost')).toHaveCount(0)
    await expect(page.getByText('Payable to supplier')).toHaveCount(0)

    await addFirstItem(page)
    await expect(page.getByLabel('Unit cost')).toHaveCount(0)
    // The rest of the drawer still works for them — the hold is theirs to set.
    await expect(page.getByRole('checkbox', { name: 'Hold for QC' })).toBeVisible()
  })
})
