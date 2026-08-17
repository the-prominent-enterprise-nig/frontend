import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Scenario 10 (Purchasing & AP) Part 7 — PO PDF download, additive to the
// existing "Send to supplier" status action. printInventoryDocument() opens
// a new window via window.open() — Playwright surfaces that as a 'popup'
// event on the originating page. Self-cleaning: cancels the draft PO it
// creates (no hard delete exists via the UI).
test.describe('Inventory — Purchase Order PDF download', () => {
  test('downloads a PO document via window.open with the right content', async ({ page }) => {
    await gotoReady(page, '/inventory/purchase-orders')

    await page.getByRole('button', { name: 'New Purchase Order' }).click()
    await expect(page.getByRole('heading', { name: 'New Purchase Order' })).toBeVisible({
      timeout: 10_000,
    })

    const supplierInput = page.getByPlaceholder('Search supplier by name or code…')
    await supplierInput.click()
    await supplierInput.fill('a')
    const supplierDropdown = page.locator('div.fixed.z-100')
    await expect(supplierDropdown).toBeVisible({ timeout: 10_000 })
    await supplierDropdown.locator('button').first().click()

    // Warehouse — required since Scenario 27 (a PO must always specify its
    // real destination warehouse now, not an editable-later "Branch" field).
    await page.locator('select').first().selectOption({ index: 1 })

    const itemInput = page.getByPlaceholder('Search item by name or SKU…')
    await itemInput.click()
    await itemInput.fill('a')
    const itemDropdown = page.locator('div.fixed.z-100')
    await expect(itemDropdown).toBeVisible({ timeout: 10_000 })
    await itemDropdown.locator('button').first().click()

    const numberInputs = page.locator('input[type="number"]')
    await fillStable(numberInputs.nth(0), '2')
    await fillStable(numberInputs.nth(1), '400')

    await page.getByRole('button', { name: 'Create Purchase Order' }).click()
    await expect(page.getByRole('heading', { name: 'New Purchase Order' })).toHaveCount(0, {
      timeout: 10_000,
    })

    // createMutation's onSuccess (usePurchaseOrders.ts) fires
    // queryClient.invalidateQueries() without awaiting it, and since the
    // list already has cached data, `isLoading` (which drives the
    // .animate-pulse skeleton) never flips true for that background
    // refetch — so waiting on the skeleton gives no real signal the list
    // has caught up. Assert on the row's own content instead (auto-retries
    // against the DOM until React re-renders with the refetched data)
    // rather than a bare visibility check, before trusting "first row" is
    // this PO.
    const firstRow = page.locator('tbody tr').first()
    await expect(firstRow).toContainText('₱800.00', { timeout: 15_000 })
    const poCode = (await firstRow.locator('td').first().textContent())?.trim()
    expect(poCode).toBeTruthy()
    const row = page.locator('tbody tr', { hasText: poCode as string })

    // IconBtn (PurchaseOrderList.tsx) renders `title` as a custom hover
    // tooltip only, not a native title="" attribute — target the Download
    // icon (lucide-download) instead of a title-attribute selector.
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      row.locator('button:has(svg.lucide-download)').click(),
    ])
    await popup.waitForLoadState('domcontentloaded')
    await expect(popup.locator('h1')).toHaveText(poCode ?? '')
    await expect(popup.getByText('Purchase Order', { exact: false })).toBeVisible()
    await popup.close()

    // Cleanup — cancel the draft PO (no hard delete exists via the UI).
    await row.locator('button:has(svg.lucide-ban)').click()
    await expect(page.getByRole('heading', { name: 'Cancel Purchase Order' })).toBeVisible({
      timeout: 10_000,
    })
    await fillStable(
      page.getByPlaceholder('Provide a reason for cancelling this purchase order…'),
      'E2E test cleanup'
    )
    await page.getByRole('button', { name: 'Cancel Order' }).click()
    await expect(page.getByRole('heading', { name: 'Cancel Purchase Order' })).toHaveCount(0, {
      timeout: 10_000,
    })
    await expect(row).toContainText('Cancelled', { timeout: 10_000 })
  })
})
