import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

// Receiving moved to the Stock hub: /inventory/operations?tab=receiving is
// gone and the entry point is the Receiving Reports tab's "New Receipt"
// button, which opens the same ReceiveStockModal (heading: "Receive Stock").

// Scenario 05 (Receiving) followup — a promotional/free item included in a
// delivery gets its own "Freebie" flag per line, zero-cost but still
// received into stock. Server-side enforcement (unitCost forced to 0
// regardless of what's submitted) is covered in the backend e2e spec
// inventory-receiving-branch-serial-gl.e2e-spec.ts's "Freebies" describe
// block — this spec only proves the UI toggle behaves correctly.
//
// Uses the shared Business Owner storageState (default project behavior) —
// this isn't a role-boundary test, just a form-behavior one.

const ITEM_SEARCH_PLACEHOLDER = 'Scan or search an item to add a line…'

// Lines are added by picking from the catalogue search rather than by an
// "Add Item" button that drops an empty row — SearchCombobox
// (src/components/ui/SearchCombobox.tsx) renders a <button> while closed and
// portals its dropdown to document.body as a `fixed z-100` panel, so the pick
// is: click the button, type, choose from the portal.
async function addFirstItem(page: Page): Promise<void> {
  await page.getByRole('button', { name: ITEM_SEARCH_PLACEHOLDER }).click()
  await page.getByPlaceholder(ITEM_SEARCH_PLACEHOLDER).fill('a')
  const dropdown = page.locator('div.fixed.z-100')
  await expect(dropdown).toBeVisible({ timeout: 10_000 })
  const option = dropdown.locator('button').first()
  await expect(option).toBeVisible({ timeout: 10_000 })
  await option.click()
}

test.describe('Inventory — Receiving freebies (Scenario 05 followup)', () => {
  test('marking a line as a freebie zeroes and locks its unit cost', async ({ page }) => {
    await gotoReady(page, '/inventory/stock?tab=reports')

    await page.getByRole('button', { name: 'New Receipt' }).click()
    await expect(page.getByRole('heading', { name: 'Receive Stock' })).toBeVisible({
      timeout: 10_000,
    })

    await addFirstItem(page)

    // Pricing lives in the line's details drawer, one click off the row: the
    // receiver's job at the bay is counting units, not re-pricing them.
    await page.getByRole('button', { name: 'Details' }).first().click()

    const unitCost = page.getByLabel('Unit cost')
    await expect(unitCost).toBeVisible()
    await expect(unitCost).not.toHaveAttribute('readonly', '')

    await page.getByRole('checkbox', { name: 'Mark as freebie' }).click()

    await expect(unitCost).toHaveValue('0')
    await expect(unitCost).toHaveAttribute('readonly', '')
    await expect(page.getByText('Zero, billed as a freebie')).toBeVisible()

    // Unticking hands the cost back.
    await page.getByRole('checkbox', { name: 'Freebie, no cost' }).click()
    await expect(unitCost).not.toHaveAttribute('readonly', '')
    await expect(page.getByText('Zero, billed as a freebie')).toHaveCount(0)
  })
})
