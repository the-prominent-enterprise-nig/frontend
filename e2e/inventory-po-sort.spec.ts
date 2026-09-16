import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Scenario 50 — the Purchase Orders list is sortable newest/oldest first.
 *
 * Sorting is server-side (`sortDir` on the PO filter DTO), so it orders the
 * whole result set rather than just the rows currently on screen — which is
 * why this asserts the order actually flips rather than only that the arrow
 * icon changed.
 *
 * Read-only: creates nothing, so there is nothing to clean up.
 */
test.describe('Inventory — Purchase Orders sort', () => {
  test('Created header toggles newest-first and oldest-first', async ({ page }) => {
    await gotoReady(page, '/inventory/purchase-orders')

    const codes = async () =>
      (await page.getByRole('row').filter({ hasText: 'PO-' }).allInnerTexts()).map(
        (t) => (t.match(/PO-[\d-]+/) ?? [''])[0]
      )

    const sortSelect = page.getByLabel('Sort order')
    await expect(sortSelect).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('row').filter({ hasText: 'PO-' }).first()).toBeVisible()

    // Default is newest first.
    await expect(sortSelect).toHaveValue('desc')
    const newestFirst = await codes()
    expect(newestFirst.length).toBeGreaterThan(1)

    await sortSelect.selectOption('asc')
    await expect(sortSelect).toHaveValue('asc')
    // Wait for the reordered page rather than racing the refetch. Only that
    // the first row changed — asserting it equals the previous page's last
    // row would assume every PO fits on one page (see the note below).
    await expect.poll(async () => (await codes())[0], { timeout: 15_000 }).not.toBe(newestFirst[0])

    // Assert the dates are actually ordered, not that this page is the
    // exact reverse of the other — that only holds while every row fits on
    // one page, and would quietly rot once there are more than `limit` POs.
    const dates = async () =>
      (await page.getByRole('row').filter({ hasText: 'PO-' }).allInnerTexts()).map((t) => {
        // First date in the row is Created (it sits under the PO code); a
        // row may also carry an Expected date further along, and sorting
        // here is by creation, so anchor on the first rather than the last.
        const m = t.match(/[A-Z][a-z]{2} \d{1,2}, \d{4}/g) ?? []
        return new Date(m[0] ?? '').getTime()
      })
    const asc = await dates()
    expect(asc.length).toBeGreaterThan(1)
    expect([...asc].sort((a, b) => a - b)).toEqual(asc)

    // And back again.
    await sortSelect.selectOption('desc')
    await expect(sortSelect).toHaveValue('desc')
    await expect.poll(async () => (await codes())[0], { timeout: 15_000 }).toBe(newestFirst[0])
    expect(await codes()).toEqual(newestFirst)
    const desc = await dates()
    expect([...desc].sort((a, b) => b - a)).toEqual(desc)
  })
})
