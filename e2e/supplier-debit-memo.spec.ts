import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Scenario 10 (Purchasing & AP) Part 9 — supplier returns via
// SupplierDebitMemo. Only available on a bill with a linked Supplier
// (not a general Vendor bill) that's been received. Verifies the bill's
// Paid/Outstanding columns and status update, mirroring the AR-side
// Credit Memo dialog's effect on an invoice. Self-cleaning: the bill it
// creates stays RECEIVED/PARTIAL afterward (no hard delete exists via the
// UI for a non-DRAFT bill — same tradeoff already accepted elsewhere in
// this suite for received bills).
test.describe('Accounting — AP Bills supplier debit memo (return)', () => {
  test('issuing a debit memo reduces the bill outstanding balance', async ({ page }) => {
    await gotoReady(page, '/accounting/ap-bills')

    // The list sorts by billDate desc — a date-only field every bill
    // created "today" shares, so ties sort in an unspecified order and
    // "first row after creation" is not reliably the one just created.
    // Diff the billNumber set before/after instead, which is robust
    // regardless of sort order.
    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    const billNumbersBefore = new Set(
      await page.locator('tbody tr td:first-child').allTextContents()
    )

    await page.getByRole('button', { name: 'New Bill' }).click()
    await expect(page.getByRole('heading', { name: 'New Bill' })).toBeVisible({ timeout: 10_000 })

    const vendorSelect = page.locator('select').first()
    await vendorSelect.selectOption({ index: 1 })

    // The supplier list loads asynchronously (fetched by the parent page,
    // passed down as a prop) — give a real second option a chance to attach
    // before deciding whether to skip, or a slow fetch reads as "no
    // suppliers" even though some exist.
    const supplierSelect = page.getByLabel('Supplier (if this bill is for a PO/RR delivery)')
    await supplierSelect
      .locator('option')
      .nth(1)
      .waitFor({ state: 'attached', timeout: 5_000 })
      .catch(() => {})
    const supplierOptionCount = await supplierSelect.locator('option').count()
    test.skip(supplierOptionCount <= 1, 'No suppliers seeded — nothing to link')
    await supplierSelect.selectOption({ index: 1 })

    await fillStable(page.locator('input[type="number"]').first(), '1000')
    const marker = `E2E-SDM-${Date.now()}`
    await fillStable(page.locator('label:has-text("Description") input'), marker)

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('heading', { name: 'New Bill' })).toHaveCount(0, {
      timeout: 10_000,
    })

    // The list reload triggered by onSaved() briefly shows a "Loading..."
    // placeholder row — wait it out, then find the one billNumber that
    // wasn't in the list before creation.
    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    await expect
      .poll(
        async () => {
          const current = await page.locator('tbody tr td:first-child').allTextContents()
          return current.filter((n) => !billNumbersBefore.has(n)).length
        },
        { timeout: 10_000 }
      )
      .toBeGreaterThan(0)
    const billNumbersAfter = await page.locator('tbody tr td:first-child').allTextContents()
    const billNumber = billNumbersAfter.find((n) => !billNumbersBefore.has(n))
    expect(billNumber).toBeTruthy()
    const row = page.locator('tbody tr', { hasText: billNumber as string })

    await row.locator('button[title="Receive"]').click()
    await expect(row).toContainText('RECEIVED', { timeout: 10_000 })

    await row.locator('button[title="Issue supplier debit memo (return)"]').click()
    await expect(page.getByRole('heading', { name: 'Issue Supplier Debit Memo' })).toBeVisible({
      timeout: 10_000,
    })

    const itemInput = page.getByPlaceholder('Search item by name or SKU…')
    await itemInput.click()
    await itemInput.fill('TN-REF-001')
    const itemDropdown = page.locator('div.fixed.z-100')
    await expect(itemDropdown).toBeVisible({ timeout: 10_000 })
    const itemOption = itemDropdown.getByRole('button', { name: /TN-REF-001/ }).first()
    await expect(itemOption).toBeVisible({ timeout: 10_000 })
    await itemOption.click()

    // "Bago Warehouse" is where TN-REF-001 actually has stock seeded —
    // an arbitrary warehouse (e.g. "index 1") may have zero on hand for
    // this item and trip the insufficient-stock validation.
    const warehouseSelect = page.getByLabel('Warehouse *')
    await warehouseSelect.selectOption({ label: 'Bago Warehouse' })

    await fillStable(page.getByLabel('Quantity Returned *'), '1')
    await fillStable(page.getByLabel('Debit Amount *'), '250')

    await page.getByRole('button', { name: 'Issue Debit Memo' }).click()
    await expect(page.getByRole('heading', { name: 'Issue Supplier Debit Memo' })).toHaveCount(0, {
      timeout: 10_000,
    })

    await expect(row).toContainText('₱250.00', { timeout: 10_000 })
    await expect(row).toContainText('PARTIAL', { timeout: 10_000 })
  })
})
