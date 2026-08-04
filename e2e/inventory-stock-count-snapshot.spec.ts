import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Scenario 19, Part 1 — expected quantity on a stock count now comes from a
// server-side snapshot of StockBalance taken when the count starts, not
// whatever the counter types in. This exercises the "found item" path (no
// prior system balance) since it doesn't depend on the shared dev database
// already having stock seeded for whichever warehouse gets picked.
test.describe('Inventory — Stock Count Snapshot (Scenario 19, Part 1)', () => {
  test('expected quantity is a read-only system snapshot, never a typed-in field', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/stock-counts')

    const warehouseSelect = page
      .locator('select')
      .filter({ has: page.locator('option', { hasText: 'Select warehouse' }) })
    await clickStable(page.getByRole('button', { name: 'New Count' }), warehouseSelect)
    await warehouseSelect.selectOption({ index: 1 })

    await expect(async () => {
      await page.getByRole('button', { name: 'Create Session' }).click()
      await expect(page.getByText('Count session created').first()).toBeVisible({
        timeout: 3_000,
      })
    }).toPass({ timeout: 15_000 })

    // Scope every subsequent "Open" click to this session's own row — the
    // shared dev database accumulates sessions across runs.
    const freshRow = page.locator('tr').filter({ hasText: 'Scheduled' })
    const sessionId = await freshRow.locator('td').first().innerText()
    const ownRow = page.locator('tr').filter({ hasText: sessionId })

    const sessionHeading = page.getByRole('heading', { name: 'Count Session' })
    await clickStable(ownRow.getByRole('button', { name: 'Open' }), sessionHeading)

    const countSheetTab = page.getByRole('button', { name: 'Count Sheet' })
    await expect(async () => {
      await page.getByRole('button', { name: 'Start Count' }).click()
      await expect(page.getByText('Count started').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })

    // The tab bar must appear immediately after starting, with no need to
    // close and reopen the modal — Part 1 also fixed the stale
    // `selectedCount` snapshot that used to require that workaround.
    await expect(countSheetTab).toBeVisible({ timeout: 5_000 })

    // No manual "Expected" input exists anywhere on the count sheet now —
    // it's always a read-only display sourced from the snapshot.
    await expect(page.getByPlaceholder('Expected')).toHaveCount(0)

    const addFoundButton = page.getByRole('button', { name: 'Add Found Item' })
    await addFoundButton.click()

    // Scope everything to this one appended row — the warehouse may already
    // carry snapshot rows from its real balance (read-only divs, not
    // <select>s), and this newly-appended found row is always the last
    // ".grid-cols-12" row on the count sheet.
    const foundRow = page.locator('.grid-cols-12').last()
    const itemSelect = foundRow
      .locator('select')
      .filter({ has: page.locator('option', { hasText: 'Select found item' }) })
    await expect(itemSelect).toBeVisible({ timeout: 5_000 })
    await itemSelect.selectOption({ index: 1 })

    // A newly-added found line shows "New find" in place of an expected qty
    // — there was never a system balance for it to snapshot.
    await expect(foundRow.getByText('New find')).toBeVisible()

    await foundRow.locator('input[placeholder="Counted"]').fill('5')

    // Variance is computed against the (zero) system baseline for a find.
    await expect(foundRow.getByText('+5')).toBeVisible()

    // Submitting completes the count — there's no UI delete/undo path, same
    // tradeoff the adjustment spec accepts for its own fixtures.
    await expect(async () => {
      await page.getByRole('button', { name: 'Submit Count' }).click()
      await expect(page.getByText('Count submitted').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })
  })
})
