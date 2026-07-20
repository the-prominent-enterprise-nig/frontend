import { test, expect, type Page } from '@playwright/test'
import { gotoReady, clickStable, selectStable } from './utils'

// Scenario 06 — Stock Request & Inter-branch Transfer. Covers the closing
// gaps as they land, one part per test. Currently covers Part 1: serial-level
// requesting on the transfer create form.
//
// Uses real seed data (see docs/seed-data-reference.md, though the exact serial
// labels there have drifted): TN-FURN-SET-001 (TV Console Furniture Set) is
// serial-tracked with in_stock serials at WH-01 (Manila HQ Warehouse),
// including FURNSET-WH-01-BULK-001. TN-FURN-TVSTAND-001 (TV Stand) is a
// non-serial-tracked item at the same warehouses.

/**
 * Confirms the "Cancel Transfer" flow in an already-open detail modal.
 * Same hydration race clickStable works around, but for a click whose
 * effect is something disappearing rather than appearing.
 */
async function confirmCancel(page: Page): Promise<void> {
  const modal = page.locator('.max-w-xl')
  await clickStable(
    modal.getByRole('button', { name: 'Cancel Transfer' }),
    modal.getByRole('button', { name: 'Yes, Cancel Transfer' })
  )
  await expect(async () => {
    await modal.getByRole('button', { name: 'Yes, Cancel Transfer' }).click()
    await expect(page.getByRole('heading', { name: 'Transfer Details' })).toBeHidden({
      timeout: 2_000,
    })
  }).toPass({ timeout: 15_000 })
}

/**
 * Filters the list to WH-01 -> WH-02 drafts and cancels any leftovers from a
 * previously interrupted run, so "first row" always unambiguously means "the
 * one this test just created" — never a stray transfer from elsewhere in the
 * (shared, real) dev database.
 */
async function resetToCleanSlate(page: Page): Promise<void> {
  const filters = page.locator('select')
  // Verifying the <select>'s own checked option isn't enough proof for a
  // CONTROLLED select — the DOM can show the right option selected even when
  // React's onChange handler missed the hydration window and the underlying
  // filter state never actually changed. Retry until the visible rows
  // themselves prove the draft filter took effect (no Cancelled/Received
  // rows leaking through).
  await expect(async () => {
    await selectStable(filters.nth(0), 'Draft')
    await selectStable(filters.nth(1), 'WH-01 — Manila HQ Warehouse')
    await selectStable(filters.nth(2), 'WH-02 — Cebu Office Warehouse')
    await expect(page.locator('tbody tr', { hasText: 'Cancelled' })).toHaveCount(0, {
      timeout: 1_000,
    })
    await expect(page.locator('tbody tr', { hasText: 'Received' })).toHaveCount(0, {
      timeout: 1_000,
    })
  }).toPass({ timeout: 20_000 })

  for (let i = 0; i < 20; i++) {
    const row = page.locator('tbody tr').first()
    if (!(await row.isVisible())) break
    await clickStable(
      row.getByRole('button', { name: 'View' }),
      page.getByRole('heading', { name: 'Transfer Details' })
    )
    await confirmCancel(page)
  }
  await expect(page.getByText('No transfers found')).toBeVisible()
}

test.describe('Stock Request & Inter-branch Transfer', () => {
  test('Part 1: create form requires a serial for a serial-tracked item and carries it to the detail view', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/transfers')
    await resetToCleanSlate(page)

    await clickStable(
      page.getByRole('button', { name: 'New Transfer' }),
      page.getByRole('heading', { name: 'New Stock Transfer' })
    )

    const form = page.locator('form')
    const selects = form.locator('select')

    await selectStable(selects.nth(0), 'WH-01 — Manila HQ Warehouse')
    await selectStable(selects.nth(1), 'WH-02 — Cebu Office Warehouse')
    await selectStable(selects.nth(2), 'TN-FURN-SET-001 — TV Console Furniture Set')

    // Serial-tracked item: quantity is locked to 1 and a serial picker appears.
    await expect(form.getByText('Qty: 1')).toBeVisible()
    await expect(form.getByText('Serial Number')).toBeVisible()

    // Submitting without a serial is blocked with an inline error.
    await page.getByRole('button', { name: 'Save as Draft' }).click()
    await expect(
      form.getByText('Select a serial number for this serial-tracked item')
    ).toBeVisible()

    await selectStable(selects.nth(3), 'FURNSET-WH-01-BULK-001')
    await page.getByRole('button', { name: 'Save as Draft' }).click()
    await expect(page.getByRole('heading', { name: 'New Stock Transfer' })).toBeHidden({
      timeout: 15_000,
    })

    // The draft/WH-01/WH-02 filter is still applied, and the leftover-cleanup
    // loop above guaranteed an empty slate first — so this is unambiguously
    // the transfer this test just created.
    const firstRow = page.locator('tbody tr').first()
    await clickStable(
      firstRow.getByRole('button', { name: 'View' }),
      page.getByRole('heading', { name: 'Transfer Details' })
    )
    const detailModal = page.locator('.max-w-xl')
    await expect(detailModal.getByText('SN: FURNSET-WH-01-BULK-001')).toBeVisible()
    await expect(detailModal.getByText('Manila HQ Warehouse', { exact: true })).toBeVisible()
    await expect(detailModal.getByText('Cebu Office Warehouse', { exact: true })).toBeVisible()

    // Self-cleaning: cancel the draft this test created.
    await confirmCancel(page)
    await expect(page.getByText('No transfers found')).toBeVisible()
  })

  test('Part 1: a non-serial-tracked item still submits normally (regression: empty serialNumberId)', async ({
    page,
  }) => {
    // The create form resets a line's serialNumberId to '' whenever the item
    // changes, even for non-serial-tracked items. The backend DTO combines
    // @IsOptional() with @IsNotEmpty() on that field, which rejects '' (only
    // undefined/null count as "not provided") — so a plain bulk-item line
    // failed with "lines.0.serialNumberId should not be empty" until the
    // server action started stripping empty strings before posting.
    await gotoReady(page, '/inventory/transfers')
    await resetToCleanSlate(page)

    await clickStable(
      page.getByRole('button', { name: 'New Transfer' }),
      page.getByRole('heading', { name: 'New Stock Transfer' })
    )

    const form = page.locator('form')
    const selects = form.locator('select')

    await selectStable(selects.nth(0), 'WH-01 — Manila HQ Warehouse')
    await selectStable(selects.nth(1), 'WH-02 — Cebu Office Warehouse')
    await selectStable(selects.nth(2), 'TN-FURN-TVSTAND-001 — TV Stand')

    // Non-serial-tracked item: plain quantity input, no serial picker.
    await expect(form.getByText('Serial Number')).toBeHidden()

    await page.getByRole('button', { name: 'Save as Draft' }).click()
    await expect(page.getByRole('heading', { name: 'New Stock Transfer' })).toBeHidden({
      timeout: 15_000,
    })
    await expect(page.getByText('should not be empty')).toHaveCount(0)

    const firstRow = page.locator('tbody tr').first()
    await clickStable(
      firstRow.getByRole('button', { name: 'View' }),
      page.getByRole('heading', { name: 'Transfer Details' })
    )

    // Self-cleaning: cancel the draft this test created.
    await confirmCancel(page)
    await expect(page.getByText('No transfers found')).toBeVisible()
  })
})
