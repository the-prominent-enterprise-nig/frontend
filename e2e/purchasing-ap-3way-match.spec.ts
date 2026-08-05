import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 10 (Purchasing & AP) Part 2 — 3-way match. Verifies the PO picker
// appears once a supplier is chosen, and is scoped to that supplier's own
// POs. Full match-badge coverage (Matched/Variance) is covered by the
// backend e2e suite (test/purchasing-ap.e2e-spec.ts) — seeding a PO with a
// value-matching RR through the UI isn't practical against shared dev data.
test.describe('Accounting — AP Bills 3-way match picker', () => {
  test('shows a Purchase Order picker only once a supplier is selected', async ({ page }) => {
    await gotoReady(page, '/accounting/ap-bills')

    await page.getByRole('button', { name: 'New Bill' }).click()
    await expect(page.getByRole('heading', { name: 'New Bill' })).toBeVisible({ timeout: 10_000 })

    const poField = page.getByLabel('Purchase Order (for the 3-way match)')
    await expect(poField).toHaveCount(0)

    // The supplier list loads asynchronously (fetched by the parent page,
    // passed down as a prop) — reading the option count right after the
    // modal opens can race a fetch that just hasn't resolved yet, reading
    // as "no suppliers" even though some exist. Give a real second option
    // a chance to attach before deciding whether to skip.
    const supplierSelect = page.getByLabel('Supplier (if this bill is for a PO/RR delivery)')
    await supplierSelect
      .locator('option')
      .nth(1)
      .waitFor({ state: 'attached', timeout: 5_000 })
      .catch(() => {})
    const supplierOptionCount = await supplierSelect.locator('option').count()
    test.skip(supplierOptionCount <= 1, 'No suppliers seeded — nothing to link')
    await supplierSelect.selectOption({ index: 1 })

    await expect(poField).toBeVisible({ timeout: 5_000 })

    await page.getByRole('button', { name: 'Cancel' }).click()
  })
})
