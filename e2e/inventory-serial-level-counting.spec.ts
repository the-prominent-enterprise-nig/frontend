import { test, expect } from '@playwright/test'
import { gotoReady, clickStable, pickSearchableOption, confirmCountAction } from './utils'

// Scenario 19, Part 5 — serial-tracked items get one count-sheet line per
// physically expected unit instead of a single aggregate quantity line.
// Backend coverage lives in
// backend/test/inventory-serial-level-counting.e2e-spec.ts; this covers the
// checklist UI itself — the serial badge, the "In Store?" checkbox
// (Scenario 87; it replaced a numeric Counted field), and that an unticked
// expected serial line still submits, as missing.
//
// Uses a fresh, dedicated warehouse and freshly-registered serials, never
// WH-01/02/03 — those shared dev warehouses carry ~1000 real serials each,
// and start()/submit() now reconcile every serial physically in the target
// warehouse (see inventory-stock-count-snapshot.spec.ts for the same fix).
test.describe('Inventory — Serial-Level Counting (Scenario 19, Part 5)', () => {
  test('expected serial lines show the serial number badge and an In Store? checkbox', async ({
    page,
  }) => {
    const warehouseCode = `E2E-CNT19P5-${Date.now()}`
    // Unique, so the Location picker's exact match can't hit an older run's.
    const warehouseName = `E2E Isolated Serial Count Warehouse ${warehouseCode}`
    const createWarehouseRes = await page.request.post('/api/inventory/warehouses', {
      data: { code: warehouseCode, name: warehouseName },
    })
    if (!createWarehouseRes.ok()) {
      throw new Error(`Failed to create isolated warehouse: ${await createWarehouseRes.text()}`)
    }
    const warehouse = (await createWarehouseRes.json()) as { id: string }

    // Also filter on isSerialTracked, not just a name match — the catalog
    // now has non-tracked service items ("Relocation of Split Type
    // Aircon", cleaning services, etc.) that can outrank the actual
    // physical item in the fuzzy search and push it past a small limit.
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

    const presentSerial = `E2E-P5-PRESENT-${Date.now()}`
    const missingSerial = `E2E-P5-MISSING-${Date.now()}`
    const registerRes = await page.request.post('/api/inventory/serial-numbers', {
      data: {
        itemId: item.id,
        warehouseId: warehouse.id,
        serialNumbers: [presentSerial, missingSerial],
      },
    })
    if (!registerRes.ok()) {
      throw new Error(`Failed to register serials: ${await registerRes.text()}`)
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
    await expect(page.getByText('Loading snapshot…')).toHaveCount(0, { timeout: 10_000 })

    // Two serial-level lines, each with its own serial badge and, since
    // Scenario 87, an "In Store?" checkbox — unticked until found.
    const presentRow = page.locator('tbody tr').filter({ hasText: presentSerial })
    const missingRow = page.locator('tbody tr').filter({ hasText: missingSerial })
    await expect(presentRow).toBeVisible()
    await expect(missingRow).toBeVisible()
    const presentInStore = page.getByLabel(`In store: ${presentSerial}`)
    const missingInStore = page.getByLabel(`In store: ${missingSerial}`)
    await expect(presentInStore).not.toBeChecked()

    // Tick only the present one; the missing one goes up unticked (0) and
    // becomes the variance line.
    await presentInStore.check()
    await expect(presentInStore).toBeChecked()
    await expect(missingInStore).not.toBeChecked()

    await confirmCountAction(page, 'Submit Count', 'Physical inventory submitted')
  })
})
