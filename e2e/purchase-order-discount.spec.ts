import { test, expect, type Page } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Scenario 10 (Purchasing & AP) Part 6 — supplier discount pricing fields on
// a PO line (SRP, discount % or flat amount, computed discountedCost) plus
// the lastPriceOverridden flag shown in the PO detail view. Self-cleaning:
// cancels the draft PO it creates (POs have no hard delete via the UI — cancel
// is the closest reversible action, same tradeoff as elsewhere in this suite).

// SearchCombobox (src/components/ui/SearchCombobox.tsx) portals its dropdown
// to document.body as a `fixed z-100` panel of plain <button> options — scope
// to that panel rather than matching buttons page-wide (the modal's own
// Save/Cancel buttons would otherwise collide with a generic text match).
async function pickFirstOption(page: Page, inputPlaceholder: string): Promise<string | null> {
  const input = page.getByPlaceholder(inputPlaceholder)
  await input.click()
  await input.fill('a')
  const dropdown = page.locator('div.fixed.z-100')
  await expect(dropdown).toBeVisible({ timeout: 10_000 })
  const option = dropdown.locator('button').first()
  await expect(option).toBeVisible({ timeout: 10_000 })
  const label = (await option.locator('span').first().textContent())?.trim() ?? null
  await option.click()
  return label
}

test.describe('Inventory — Purchase Order discount pricing', () => {
  test('captures SRP + percentage discount and shows the computed discounted cost', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/purchase-orders')

    await page.getByRole('button', { name: 'New Purchase Order' }).click()
    await expect(page.getByRole('heading', { name: 'New Purchase Order' })).toBeVisible({
      timeout: 10_000,
    })

    const supplierLabel = await pickFirstOption(page, 'Search supplier by name or code…')
    await pickFirstOption(page, 'Search item by name or SKU…')

    const numberInputs = page.locator('input[type="number"]')
    await fillStable(numberInputs.nth(0), '10') // Quantity
    await fillStable(numberInputs.nth(1), '850') // Unit Price
    await fillStable(numberInputs.nth(2), '1000') // Supplier SRP
    await page.locator('select').selectOption('percentage')
    await fillStable(numberInputs.nth(3), '15') // Discount %

    await expect(page.getByText('Discounted cost:')).toBeVisible()
    await expect(page.getByText('₱850.00', { exact: false })).toBeVisible()

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
    // against the DOM until React re-renders with the refetched data, with
    // no assumption about which network call causes it) rather than a bare
    // visibility check, before trusting "first row" is this PO.
    const firstRow = page.locator('tbody tr').first()
    await expect(firstRow).toContainText('₱8,500.00', { timeout: 15_000 })
    const poCode = (await firstRow.locator('td').first().textContent())?.trim()
    expect(poCode).toBeTruthy()
    const row = page.locator('tbody tr', { hasText: poCode as string })
    if (supplierLabel) {
      await expect(row).toContainText(supplierLabel)
    }

    // Open the detail modal — click the Code cell specifically rather than
    // the row's center, since the Actions cell (far right) stops propagation
    // and a centered click on a wide multi-column row is otherwise ambiguous.
    await row.locator('td').first().click()
    await expect(page.getByText('Line Items')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/SRP.*1,000/, { exact: false })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('15%', { exact: false })).toBeVisible()
    await page.locator('div.fixed button:has(svg.lucide-x)').first().click()

    // Cleanup — cancel the draft PO (no hard delete exists via the UI).
    // IconBtn (PurchaseOrderList.tsx) renders `title` as a custom hover
    // tooltip only, not a native title="" attribute — target the Ban icon
    // (lucide-ban) instead of a title-attribute selector.
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
