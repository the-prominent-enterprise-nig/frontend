import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 05 (Receiving) followup — a promotional/free item included in a
// delivery gets its own "Freebie" flag per line, zero-cost but still
// received into stock. Server-side enforcement (unitCost forced to 0
// regardless of what's submitted) is covered in the backend e2e spec
// inventory-receiving-branch-serial-gl.e2e-spec.ts's "Freebies" describe
// block — this spec only proves the UI toggle behaves correctly.
//
// Uses the shared Business Owner storageState (default project behavior) —
// this isn't a role-boundary test, just a form-behavior one.

test.describe('Inventory — Receiving freebies (Scenario 05 followup)', () => {
  test('marking a line as a freebie replaces the Unit Cost input with "Free"', async ({ page }) => {
    await gotoReady(page, '/inventory/operations?tab=receiving')

    await page.getByRole('button', { name: 'Receive Stock' }).click()
    await expect(page.getByRole('heading', { name: 'Receive Stock' })).toBeVisible({
      timeout: 10_000,
    })

    await page.getByRole('button', { name: 'Add Item' }).click()

    const unitCostInput = page.getByRole('columnheader', { name: 'Unit Cost' })
    await expect(unitCostInput).toBeVisible()

    // The Stock Balances table sits behind the modal and stays in the DOM,
    // so a bare `tbody tr` matches its rows first — scope to the modal's
    // own line-items table, which is the last <table> in DOM order (it's
    // rendered after the page content, not portaled).
    const lineItemsTable = page.locator('table').last()
    const row = lineItemsTable.locator('tbody tr').first()
    const costCell = row.locator('td').nth(2) // Item, Qty, Unit Cost
    await expect(costCell.locator('input[type="number"]')).toBeVisible()

    const freebieCheckbox = row.locator('td').nth(3).locator('input[type="checkbox"]')
    await freebieCheckbox.check()

    await expect(costCell.getByText('Free')).toBeVisible()
    await expect(costCell.locator('input[type="number"]')).toHaveCount(0)

    // Unchecking brings the editable cost input back.
    await freebieCheckbox.uncheck()
    await expect(costCell.locator('input[type="number"]')).toBeVisible()
    await expect(costCell.getByText('Free')).toHaveCount(0)
  })
})
