import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 29 — reported live: clicking "New Purchase" from the default
// Purchase Orders tab always drafts a Purchase Request (never a live PO —
// see CreatePoModal.tsx's own doc comment, "there's no more 'skip the
// draft, create a live PO' path"), but PurchaseOrderList only ever fetches
// /procurement/purchase-orders, so the thing just created never appeared
// anywhere — it looked like the submission vanished. Fix: after a
// successful create from either tab, follow the URL to ?tab=requests,
// where the new PR actually lives.

// SearchCombobox (src/components/ui/SearchCombobox.tsx) portals its
// dropdown to document.body as a `fixed z-100` panel — scope to that
// rather than matching page-wide.
async function pickFirstOption(page: Page, inputPlaceholder: string): Promise<void> {
  const input = page.getByPlaceholder(inputPlaceholder)
  await input.click()
  await input.fill('a')
  const dropdown = page.locator('div.fixed.z-100')
  await expect(dropdown).toBeVisible({ timeout: 10_000 })
  const option = dropdown.locator('button').first()
  await expect(option).toBeVisible({ timeout: 10_000 })
  await option.click()
}

test.describe('Inventory — creating a purchase from the Purchase Orders tab', () => {
  test('lands on the Purchase Requests tab, where the new draft actually is', async ({ page }) => {
    // Default tab, no ?tab= param — this is the exact page a user lands on
    // from the sidebar link.
    await gotoReady(page, '/inventory/purchase-orders')
    const tabNav = page.getByLabel('Module tabs')
    await expect(tabNav.getByRole('link', { name: 'Purchase Orders' })).toBeVisible({
      timeout: 10_000,
    })

    await page.getByRole('button', { name: 'New Purchase' }).click()
    await expect(page.getByRole('heading', { name: 'New Purchase' })).toBeVisible({
      timeout: 10_000,
    })

    await pickFirstOption(page, 'Search supplier by name or code…')
    await page.locator('select').first().selectOption({ index: 1 }) // Warehouse
    await pickFirstOption(page, 'Search item by name or SKU…')

    const numberInputs = page.locator('input[type="number"]')
    await numberInputs.nth(0).fill('2') // Quantity
    await numberInputs.nth(1).fill('500') // Unit Price

    await page.getByRole('button', { name: 'Create Purchase Request' }).click()
    await expect(page.getByRole('heading', { name: 'New Purchase' })).toHaveCount(0, {
      timeout: 10_000,
    })

    // The whole point of the fix: the URL itself moves to the tab that has
    // the record, rather than leaving the user on the empty-looking one.
    await expect(page).toHaveURL(/[?&]tab=requests/, { timeout: 15_000 })
    await expect(tabNav.getByRole('link', { name: 'Purchase Requests' })).toBeVisible()

    // And the row is actually there, not just the tab.
    const firstRow = page.locator('tbody tr').first()
    await expect(firstRow).toContainText('₱1,000.00', { timeout: 15_000 })
    await expect(firstRow).toContainText(/draft|submitted/i)

    // Cleanup — a draft PR cancels with a single click, no reason/modal.
    await firstRow.getByRole('button', { name: 'Cancel' }).click()
    await expect(firstRow).toContainText(/cancelled/i, { timeout: 10_000 })
  })
})
