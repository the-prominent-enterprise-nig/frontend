import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 08 (Caravan) Part 2 — "Caravan" view. Runs as Business
// Owner (only seeded storage state), who has no own branch — so this
// exercises the "must explicitly pick a branch first" path, the more
// involved of the two (a branch-restricted Stock Controller/Branch Manager
// never sees the picker at all; their own branch is forced server-side).
// No UI exists yet to actually consign a serial (Part 1 is API-only, by
// design — see the plan doc), so this covers structure/gating, not rendered
// consigned rows; see the scenario doc's manual test steps for that.
test.describe('Inventory — Caravan view', () => {
  test('tab switch reveals a branch picker for an unrestricted caller and gates the list until one is picked', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/serial-numbers')

    const allSerialsTab = page.getByRole('button', { name: 'All Serials' })
    const caravanTab = page.getByRole('button', { name: 'Caravan' })
    await expect(allSerialsTab).toBeVisible({ timeout: 15_000 })
    await expect(caravanTab).toBeVisible()

    await caravanTab.click()

    // Business Owner has no own branch — the view must gate on an explicit
    // pick rather than silently querying with no branch at all.
    await expect(
      page.getByText("Select a branch above to see what's consigned to it.")
    ).toBeVisible({ timeout: 10_000 })

    const branchPicker = page.getByPlaceholder('Select a branch…')
    await expect(branchPicker).toBeVisible()

    await branchPicker.click()
    const firstOption = page
      .locator('[role="option"], li, button')
      .filter({ hasText: /HQ|Office|Branch/ })
    await expect(firstOption.first()).toBeVisible({ timeout: 10_000 })
    await firstOption.first().click()

    // Once a branch is picked, the gating prompt clears — either the table
    // or the "nothing consigned" empty state renders, never the prompt.
    await expect(
      page.getByText("Select a branch above to see what's consigned to it.")
    ).toHaveCount(0, { timeout: 10_000 })

    const emptyState = page.getByText('Nothing currently consigned to this branch')
    const table = page.locator('table')
    await expect(emptyState.or(table)).toBeVisible({ timeout: 10_000 })

    // Switching back to All Serials restores the normal warehouse filter and
    // drops the branch picker entirely.
    await allSerialsTab.click()
    await expect(branchPicker).toHaveCount(0)
  })
})
