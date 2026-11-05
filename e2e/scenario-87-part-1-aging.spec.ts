import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 87 Part 1 — the Inventory Aging screen in the client's terms.
// Filters are Location / Group / Category / Classification and only apply on
// Process; Export to Excel is held back while the filters on screen differ
// from the ones the table was loaded with. The workbook's own layout and the
// filter semantics (Group ⊇ Subgroups, Repo vs Brand New, branch scoping)
// are covered by backend/test/scenario-87-part-1-aging-export.e2e-spec.ts.
// Read-only: creates nothing, so nothing to clean up.

/** Picks an option from a SearchableSelect found by its aria-label. */
async function pickOption(page: Page, ariaLabel: string, option: string): Promise<void> {
  const input = page.getByLabel(ariaLabel, { exact: true })
  await expect(async () => {
    await input.click()
    await input.fill(option)
    await page
      .getByTestId('searchable-select-option')
      .filter({ hasText: new RegExp(`^${option}$`) })
      .click({ timeout: 3_000 })
  }).toPass({ timeout: 20_000 })
}

test.describe('Scenario 87 Part 1 — Inventory Aging filters', () => {
  test('shows the client filters and applies them only on Process', async ({ page }) => {
    await gotoReady(page, '/inventory/reports')
    await expect(page.getByRole('heading', { name: 'Inventory Aging Report' })).toBeVisible({
      timeout: 20_000,
    })

    for (const label of ['As of date', 'Location', 'Type', 'Category', 'Classification']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    }

    const process = page.getByRole('button', { name: /^(Process|Refresh)$/ })
    const exportButton = page.getByRole('button', { name: 'Export to Excel' })
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 20_000 })
    await expect(process).toHaveText('Refresh')
    await expect(exportButton).toBeEnabled()

    // Staging a filter doesn't reload the table; it arms Process and holds
    // the export so the file can't disagree with the screen.
    await pickOption(page, 'All classifications', 'Repo')
    await expect(process).toHaveText('Process')
    await expect(exportButton).toBeDisabled()

    await process.click()
    await expect(process).toHaveText('Refresh')
    // Either the repossessed units, or the empty state — never brand-new stock.
    await expect(page.locator('tbody tr').first().or(page.getByText('No units match'))).toBeVisible(
      { timeout: 20_000 }
    )
  })
})
