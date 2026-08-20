import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 33 (Supplier/Vendor merge) Part 3 — collapsed the old separate
// required Vendor + optional Supplier fields into one required Supplier
// field. Verifies the "New Bill" form now has a single required Supplier
// select, and that a bill created through it shows the supplier in the
// list. Self-cleaning: deletes the DRAFT bill it creates.
test.describe('Accounting — AP Bills supplier link', () => {
  test('creates a bill with a required supplier and shows it in the list', async ({ page }) => {
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

    // The supplier list loads asynchronously (fetched by the parent page,
    // passed down as a prop) — give a real second option a chance to attach
    // before deciding whether to skip, or a slow fetch reads as "no
    // suppliers" even though some exist.
    const supplierSelect = page.getByLabel('Supplier *')
    await supplierSelect
      .locator('option')
      .nth(1)
      .waitFor({ state: 'attached', timeout: 5_000 })
      .catch(() => {})
    const supplierOptionCount = await supplierSelect.locator('option').count()
    test.skip(supplierOptionCount <= 1, 'No suppliers seeded — nothing to link')
    await supplierSelect.selectOption({ index: 1 })
    const supplierLabel = (await supplierSelect.locator('option').nth(1).textContent())?.trim()

    const subtotalInput = page.locator('input[type="number"]').first()
    await subtotalInput.fill('1000')
    const marker = `E2E-AP-${Date.now()}`
    const descriptionInput = page.locator('label:has-text("Description") input')
    await descriptionInput.fill(marker)

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('heading', { name: 'New Bill' })).toHaveCount(0, {
      timeout: 10_000,
    })

    // Bill descriptions aren't shown in the table — find the one billNumber
    // that wasn't in the list before creation, re-open that exact row, and
    // confirm the supplier before scoping cleanup to it.
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
    if (supplierLabel) {
      await expect(row).toContainText(supplierLabel.split(' — ')[1] ?? supplierLabel)
    }
    await row.locator('button.text-purple-600').click() // Edit
    await expect(page.getByRole('heading', { name: 'Edit Bill' })).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('label:has-text("Description") input')).toHaveValue(marker)
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Cleanup — delete the DRAFT bill this test created. Other pre-existing
    // bills stay in the list, so assert on this bill's own number being gone
    // rather than the row count (which won't hit zero).
    page.once('dialog', (dialog) => dialog.accept())
    await row.locator('button.text-red-600').click()
    if (billNumber) {
      await expect(page.locator('tbody')).not.toContainText(billNumber, { timeout: 10_000 })
    }
  })
})
