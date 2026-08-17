import { test, expect } from '@playwright/test'
import { gotoReady, loginAs, clickStable } from './utils'

// Scenario 05 followup, Part 5 — Freebies on "Receive against PO".
// ReceiveAgainstPoModal was previously locked to exactly the PO's own
// lines; "Add Freebie Item" lets the receiver add a supplier-given free
// extra unit that was never on the original order. Backend mechanics
// (mixed PO-tied + untied lines in one receive call) are already covered
// by inventory-po-receiving-freebie.e2e-spec.ts — this spec only proves
// the UI path exists and works.
//
// Opts out of the shared Business Owner storageState (same reasoning as
// the other cost-visibility specs) since it needs to log in as a second
// role too.
test.use({ storageState: { cookies: [], origins: [] } })

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'technova.owner@test.com'
const STOCK_CONTROLLER_EMAIL = process.env.E2E_STOCK_EMAIL ?? 'technova.b1.stock@test.com'
const PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'dev-prominent-enterprise-2026'

async function openReceiveAgainstPoModal(page: import('@playwright/test').Page) {
  await gotoReady(page, '/inventory/purchase-orders')
  await expect(page.getByRole('heading', { name: 'Purchase Orders' })).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 })
  // "Sent" status rows show exactly two action buttons — Download PDF, then
  // Receive stock (neither has an accessible name; PurchaseOrderList.tsx's
  // IconBtn shows its label via a hover tooltip, not aria-label/title).
  await clickStable(page.getByRole('button', { name: 'Sent' }), page.locator('tbody tr').first())
  await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 })
  await clickStable(
    page.locator('tbody tr').first().locator('td').last().locator('button').last(),
    page.getByRole('heading', { name: 'Receive Stock Against PO' })
  )
}

test.describe('Inventory — PO receiving freebie (Scenario 05 followup, Part 5)', () => {
  test('Business Owner can add a freebie item on Receive Against PO', async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, PASSWORD)
    await openReceiveAgainstPoModal(page)

    const rowCountBefore = await page.locator('tbody tr').count()
    await page.getByRole('button', { name: 'Add Freebie Item' }).click()
    await expect(page.locator('tbody tr')).toHaveCount(rowCountBefore + 1)

    await expect(page.getByText('Freebie', { exact: true })).toBeVisible()
    await expect(page.getByText('Free', { exact: true })).toBeVisible()
    await expect(page.getByPlaceholder('Search item by name or SKU…')).toBeVisible()
  })

  test('Stock Controller can also add a freebie item, without seeing a Unit Cost column', async ({
    page,
  }) => {
    await loginAs(page, STOCK_CONTROLLER_EMAIL, PASSWORD)
    await openReceiveAgainstPoModal(page)

    await expect(page.getByRole('columnheader', { name: 'Unit Cost' })).toHaveCount(0)

    const rowCountBefore = await page.locator('tbody tr').count()
    await page.getByRole('button', { name: 'Add Freebie Item' }).click()
    await expect(page.locator('tbody tr')).toHaveCount(rowCountBefore + 1)

    await expect(page.getByText('Freebie', { exact: true })).toBeVisible()
    await expect(page.getByPlaceholder('Search item by name or SKU…')).toBeVisible()
  })
})
