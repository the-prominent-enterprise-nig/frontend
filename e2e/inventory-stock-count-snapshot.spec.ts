import { test, expect } from '@playwright/test'
import { gotoReady, clickStable, pickSearchableOption, confirmCountAction } from './utils'

// Scenario 19, Part 1 — expected quantity on a stock count now comes from a
// server-side snapshot of StockBalance taken when the count starts, not
// whatever the counter types in. This exercises the "found item" path (a
// unit the snapshot didn't list — since Scenario 87, searched by serial) so
// it doesn't depend on the shared dev database having stock seeded for
// whichever warehouse gets picked.
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
    // Unique, so the Location picker's exact match can't hit an older run's.
    const warehouseName = `E2E Isolated Count Warehouse ${warehouseCode}`
    const createWarehouseRes = await page.request.post('/api/inventory/warehouses', {
      data: { code: warehouseCode, name: warehouseName },
    })
    if (!createWarehouseRes.ok()) {
      throw new Error(`Failed to create isolated warehouse: ${await createWarehouseRes.text()}`)
    }

    // The found unit: registered at a second fresh warehouse, so it is
    // "elsewhere" as far as this count is concerned.
    const elsewhereRes = await page.request.post('/api/inventory/warehouses', {
      data: { code: `${warehouseCode}-X`, name: `${warehouseName} (elsewhere)` },
    })
    const elsewhere = (await elsewhereRes.json()) as { id: string }
    const itemsRes = await page.request.get(
      `/api/inventory/items?search=${encodeURIComponent('Split-Type Aircon')}&limit=20`
    )
    const items = ((await itemsRes.json()).data ?? []) as {
      id: string
      name: string
      isSerialTracked: boolean
    }[]
    const item = items.find((i) => i.name.includes('Split-Type Aircon') && i.isSerialTracked)
    if (!item) throw new Error('Split-Type Aircon fixture item not found')
    const foundSerial = `E2E-S87-FOUND-${Date.now()}`
    const registerRes = await page.request.post('/api/inventory/serial-numbers', {
      data: { itemId: item.id, warehouseId: elsewhere.id, serialNumbers: [foundSerial] },
    })
    if (!registerRes.ok()) {
      throw new Error(`Failed to register the found unit: ${await registerRes.text()}`)
    }

    await gotoReady(page, '/inventory/reports?tab=physical-inventory')

    await clickStable(
      page.getByRole('button', { name: 'New Physical Inventory' }),
      page.getByLabel('Location', { exact: true })
    )
    // Options read the warehouse's branch name, else its own name.
    await pickSearchableOption(page, 'Location', warehouseName)

    // Dated today, so creating it starts it and opens its sheet straight away.
    await expect(async () => {
      await page.getByRole('button', { name: 'Create Physical Inventory' }).click()
      await expect(page.getByText('Physical inventory started').first()).toBeVisible({
        timeout: 3_000,
      })
    }).toPass({ timeout: 15_000 })

    await expect(page.getByRole('heading', { name: 'Count Session' })).toBeVisible({
      timeout: 5_000,
    })
    await expect(page.getByLabel('Scan or search the count sheet')).toBeVisible({
      timeout: 5_000,
    })

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
    // the first row on the count sheet, not the last.
    // Scenario 87: every NIG item is serialized, so Add Found Item searches
    // a unit by serial — here one the system has at another warehouse.
    const foundRow = page.locator('tbody tr').first()
    const finder = foundRow.getByPlaceholder('Search the serial number…')
    await expect(finder).toBeVisible({ timeout: 5_000 })
    await expect(async () => {
      await finder.fill(foundSerial)
      await page.getByText(foundSerial, { exact: true }).last().click({ timeout: 3_000 })
    }).toPass({ timeout: 20_000 })

    // A newly-added found line shows "New find" — there was never a system
    // record of it here for the snapshot to list — and starts ticked.
    await expect(foundRow.getByText('New find')).toBeVisible()
    await expect(page.getByLabel(`In store: ${foundSerial}`)).toBeChecked()

    // Submitting completes the count — there's no UI delete/undo path, same
    // tradeoff the adjustment spec accepts for its own fixtures.
    await confirmCountAction(page, 'Submit Count', 'Physical inventory submitted')
  })
})
