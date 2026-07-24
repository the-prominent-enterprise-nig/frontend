import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 08 (Caravan) Part 2 — "Caravan @ Host" tab on the Serial Number
// Tracking page. Covers the tab/picker UI itself; doesn't assert on a real
// consigned item showing up, since there's no "return to origin" endpoint
// yet (Part 5) to undo a real consignment afterward — mutating live seed
// data here with no way back isn't worth it for a UI-behavior check. The
// backend e2e spec (inventory-caravan-consign.e2e-spec.ts) already covers
// the real consign + filtered-view data end to end with its own
// self-cleaning fixtures.
test.describe('Inventory — Serial Numbers — Caravan @ Host tab', () => {
  test('switches to the Caravan tab, prompts Business Owner for a branch, and switches back', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/serial-numbers')

    await expect(page.getByRole('heading', { name: 'Serial Number Tracking' })).toBeVisible({
      timeout: 15_000,
    })

    const allTab = page.getByRole('button', { name: 'All Serials' })
    const caravanTab = page.getByRole('button', { name: 'Caravan @ Host' })
    await expect(allTab).toBeVisible()
    await expect(caravanTab).toBeVisible()

    // Warehouse filter is the "All Serials" tab's own filter — not shown once
    // the Caravan tab replaces it with a branch picker. Both filters are a
    // SearchableSelect (type-ahead), identified by their placeholder text
    // rather than a native <select>'s options.
    const warehouseFilter = page.getByPlaceholder('All Warehouses')
    await expect(warehouseFilter).toBeVisible()

    await caravanTab.click()

    // Business Owner has no home branch — the Caravan tab must prompt for
    // one explicitly rather than silently showing nothing.
    await expect(
      page.getByText("Select a branch above to see what's consigned to it.")
    ).toBeVisible({ timeout: 10_000 })
    const branchPicker = page.getByPlaceholder('Select a branch…')
    await expect(branchPicker).toBeVisible()
    await expect(warehouseFilter).toHaveCount(0)

    // Picking a branch clears the prompt and (successfully or as an empty
    // state) resolves the caravan view for that branch. Opening the
    // SearchableSelect renders its options as buttons in a floating panel —
    // grab whichever one happens to be first, same as the old test picked
    // whichever <option> happened to be first.
    await branchPicker.click()
    const firstOption = page.locator('div.absolute.z-50 button').first()
    const optionCount = await page.locator('div.absolute.z-50 button').count()
    if (optionCount > 0) {
      const branchName = (await firstOption.textContent())?.trim()
      await firstOption.click()
      if (branchName) {
        await expect(branchPicker).toHaveValue(branchName)
      }
      await expect(
        page.getByText("Select a branch above to see what's consigned to it.")
      ).toHaveCount(0, { timeout: 10_000 })
    }

    // Switching back restores the normal warehouse filter and drops the tab-specific UI.
    await allTab.click()
    await expect(warehouseFilter).toBeVisible()
    await expect(branchPicker).toHaveCount(0)
  })
})
