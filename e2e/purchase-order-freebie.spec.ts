import { test, expect, type Page } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Scenario 10 (Purchasing & AP) Part 8 — PO freebies, captured at PO time
// only. Checking "Freebie" zeroes Unit Price client-side (the server also
// forces it to 0 regardless of input) and excludes the line from the
// subtotal. Self-cleaning: cancels the draft PO it creates.

// SearchCombobox (src/components/ui/SearchCombobox.tsx) portals its dropdown
// to document.body as a `fixed z-100` panel of plain <button> options.
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

test.describe('Inventory — Purchase Order freebies', () => {
  test('checking Freebie zeroes the unit price and excludes it from the subtotal', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/purchase-orders')

    await page.getByRole('button', { name: 'New Purchase Order' }).click()
    await expect(page.getByRole('heading', { name: 'New Purchase Order' })).toBeVisible({
      timeout: 10_000,
    })

    await pickFirstOption(page, 'Search supplier by name or code…')
    await pickFirstOption(page, 'Search item by name or SKU…')

    const numberInputs = page.locator('input[type="number"]')
    await fillStable(numberInputs.nth(0), '5') // Quantity
    await fillStable(numberInputs.nth(1), '300') // Unit Price

    const subtotalBefore = page.locator('text=Subtotal:').locator('..')
    await expect(subtotalBefore).toContainText('₱1,500.00')

    await page.getByText('Freebie (supplier-given free unit — no cost)').click()
    await expect(numberInputs.nth(1)).toBeDisabled()
    await expect(numberInputs.nth(1)).toHaveValue('0')
    await expect(page.locator('text=Subtotal:').locator('..')).toContainText('₱0.00')

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
    await expect(firstRow).toContainText('Draft', { timeout: 15_000 })
    await expect(firstRow).toContainText('₱0.00', { timeout: 15_000 })
    const poCode = (await firstRow.locator('td').first().textContent())?.trim()
    expect(poCode).toBeTruthy()
    const row = page.locator('tbody tr', { hasText: poCode as string })

    // Open the detail modal and confirm the Freebie badge renders.
    await row.locator('td').first().click()
    await expect(page.getByText('Line Items')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Freebie', { exact: true })).toBeVisible()
    await page.locator('div.fixed button:has(svg.lucide-x)').first().click()

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
