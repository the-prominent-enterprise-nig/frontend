import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Scenario 19, Part 1 — expected quantity on a stock count now comes from a
// server-side snapshot of StockBalance taken when the count starts, not
// whatever the counter types in. This exercises the "found item" path (no
// prior system balance) since it doesn't depend on the shared dev database
// already having stock seeded for whichever warehouse gets picked.
//
// The warehouse must be a fresh, dedicated one rather than whichever shared
// WH-0x lands at dropdown index 1 — Scenario 19 Part 5 made start()/submit()
// snapshot and reconcile every serial-tracked unit physically in the target
// warehouse, and the shared dev warehouses carry ~1000 real serials each.
// Submitting this count against one of them would sweep all of that
// inventory into a single giant pending adjustment (see the backend's
// inventory-stock-count-snapshot.e2e-spec.ts for the same fix).
test.describe('Inventory — Stock Count Snapshot (Scenario 19, Part 1)', () => {
  test('expected quantity is a read-only system snapshot, never a typed-in field', async ({
    page,
  }) => {
    const warehouseCode = `E2E-CNT19P1-${Date.now()}`
    const createWarehouseRes = await page.request.post('/api/inventory/warehouses', {
      data: { code: warehouseCode, name: 'E2E Isolated Count Warehouse' },
    })
    if (!createWarehouseRes.ok()) {
      throw new Error(`Failed to create isolated warehouse: ${await createWarehouseRes.text()}`)
    }
    const warehouse = (await createWarehouseRes.json()) as { id: string }

    await gotoReady(page, '/inventory/stock-counts')

    const warehouseSelect = page
      .locator('select')
      .filter({ has: page.locator('option', { hasText: 'Select warehouse' }) })
    await clickStable(page.getByRole('button', { name: 'New Count' }), warehouseSelect)
    await warehouseSelect.selectOption({ value: warehouse.id })

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
    await clickStable(ownRow, sessionHeading)

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

    // Starting the count enables the count-lines snapshot query, which
    // resolves asynchronously. The seeding effect that maps that response
    // into local sheet state re-runs on every resolution, so clicking "Add
    // Found Item" before the first resolution lands can have a found row
    // appended locally only to be wiped out moments later when the
    // snapshot query finally settles. Wait for the loading state to clear
    // first so the seed has already happened once.
    await expect(page.getByText('Loading snapshot…')).toHaveCount(0, { timeout: 10_000 })

    const addFoundButton = page.getByRole('button', { name: 'Add Found Item' })
    await addFoundButton.click()

    // Scope everything to this one prepended row — the sheet shows
    // most-recently-added first, so a freshly added found row is always
    // the first ".grid-cols-12" row on the count sheet, not the last.
    const foundRow = page.locator('.grid-cols-12').first()
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
