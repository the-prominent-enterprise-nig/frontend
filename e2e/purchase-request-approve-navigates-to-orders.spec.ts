import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 29 — the mirror case of purchase-order-list-create-navigates-to-
// requests.spec.ts: a fully-specified Purchase Request (supplier + priced
// lines already set) auto-converts into a real PO the moment its single
// approval tier is granted (PurchaseRequestService.approve()). The PR then
// drops out of the default (non-'converted') Purchase Requests list by
// design (see that service's findAll()) — this proves the approver is
// followed to the Purchase Orders tab, where the new PO actually landed,
// instead of being left looking at a list the record just vanished from.

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

test.describe('Inventory — approving a fully-specified Purchase Request', () => {
  test('auto-converts to a PO and follows the approver to the Purchase Orders tab', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/purchase-orders?tab=requests')
    const tabNav = page.getByLabel('Module tabs')
    await expect(tabNav.getByRole('link', { name: 'Purchase Requests' })).toBeVisible({
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
    await numberInputs.nth(0).fill('3') // Quantity
    await numberInputs.nth(1).fill('400') // Unit Price
    await page.getByRole('button', { name: 'Create Purchase Request' }).click()
    await expect(page.getByRole('heading', { name: 'New Purchase' })).toHaveCount(0, {
      timeout: 10_000,
    })

    const row = page.locator('tbody tr').first()
    await expect(row).toContainText('₱1,200.00', { timeout: 15_000 })
    const prCode = (await row.locator('td').first().textContent())?.trim()
    expect(prCode).toBeTruthy()

    await row.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByRole('heading', { name: 'Submit Purchase Request' })).toBeVisible({
      timeout: 10_000,
    })
    await page
      .locator('.fixed.inset-0')
      .getByRole('button', { name: 'Submit', exact: true })
      .click()
    await expect(page.getByRole('heading', { name: 'Submit Purchase Request' })).toHaveCount(0, {
      timeout: 10_000,
    })
    await expect(row).toContainText(/submitted/i, { timeout: 10_000 })

    await row.getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByRole('heading', { name: 'Approve Purchase Request' })).toBeVisible({
      timeout: 10_000,
    })
    // This PR has a supplier and fully priced lines already, so this is the
    // exact case the modal itself warns about.
    await expect(
      page.getByText('approving will convert this directly into a Purchase Order', {
        exact: false,
      })
    ).toBeVisible()
    await page
      .locator('.fixed.inset-0')
      .getByRole('button', { name: 'Approve', exact: true })
      .click()
    await expect(page.getByRole('heading', { name: 'Approve Purchase Request' })).toHaveCount(0, {
      timeout: 10_000,
    })

    // The fix under test: the URL follows the record to where it now lives.
    await expect(page).toHaveURL(/[?&]tab=orders/, { timeout: 15_000 })
    await expect(tabNav.getByRole('link', { name: 'Purchase Orders' })).toBeVisible()

    const poRow = page.locator('tbody tr').first()
    await expect(poRow).toContainText('₱1,200.00', { timeout: 15_000 })

    // Cleanup — cancel the new PO (no hard delete via the UI).
    await poRow.locator('button:has(svg.lucide-ban)').click()
    await expect(page.getByRole('heading', { name: 'Cancel Purchase Order' })).toBeVisible({
      timeout: 10_000,
    })
    await page
      .getByPlaceholder('Provide a reason for cancelling this purchase order…')
      .fill('E2E test cleanup')
    await page.getByRole('button', { name: 'Cancel Order' }).click()
    await expect(page.getByRole('heading', { name: 'Cancel Purchase Order' })).toHaveCount(0, {
      timeout: 10_000,
    })
    await expect(poRow).toContainText(/cancelled/i, { timeout: 10_000 })
  })
})
