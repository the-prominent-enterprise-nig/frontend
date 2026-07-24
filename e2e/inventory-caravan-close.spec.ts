import { test, expect, type APIRequestContext } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 08 (Caravan) Part 5 — event close (return to origin / move onward).
// Reuses a real, already-registered, in-stock Furniture Set serial at Manila
// HQ rather than registering a throwaway one — there's no delete endpoint
// for serial numbers, so anything freshly registered here would be
// permanent debris. Consigning it to Cebu and then returning it to origin
// via the UI under test is fully self-cleaning: the round trip leaves the
// serial exactly as it started. Everything that identifies *which* serial to
// use is resolved live via the API (item/warehouse/serial lookups) rather
// than a hardcoded serial number, since this codebase's seed data has picked
// up extra bulk-registered Furniture Set serials over time and any one
// literal name could stop existing. Part 1 (consign) has no frontend UI of
// its own yet, so that step goes straight through the API proxy, same as a
// real client fetch would — the UI is only exercised for what Part 5
// actually built.
test.describe('Inventory — Serial Numbers — Caravan event close', () => {
  const ITEM_SKU = 'TN-FURN-SET-001'
  const WAREHOUSE_CODE = 'WH-01'

  async function findAvailableSerial(
    request: APIRequestContext
  ): Promise<{ id: string; serialNumber: string }> {
    const itemsRes = await request.get(
      `/api/inventory/items?search=${encodeURIComponent(ITEM_SKU)}`
    )
    const itemsBody = await itemsRes.json()
    const item = (itemsBody?.data ?? []).find((i: { sku: string }) => i.sku === ITEM_SKU)
    if (!item) throw new Error(`Seed item ${ITEM_SKU} not found — check seed data`)

    const warehousesRes = await request.get('/api/inventory/warehouses?limit=50')
    const warehousesBody = await warehousesRes.json()
    const warehouse = (warehousesBody?.data ?? []).find(
      (w: { code: string }) => w.code === WAREHOUSE_CODE
    )
    if (!warehouse) throw new Error(`Seed warehouse ${WAREHOUSE_CODE} not found — check seed data`)

    const serialsRes = await request.get(
      `/api/inventory/serial-numbers?itemId=${item.id}&warehouseId=${warehouse.id}&status=in_stock&limit=100`
    )
    const serialsBody = await serialsRes.json()
    const available = (serialsBody?.data ?? []).find(
      (s: { consignedToBranchId: string | null }) => s.consignedToBranchId === null
    )
    if (!available) {
      throw new Error(
        `No non-consigned in-stock ${ITEM_SKU} serial found at ${WAREHOUSE_CODE} — check seed data`
      )
    }
    return { id: available.id, serialNumber: available.serialNumber }
  }

  async function returnToOrigin(request: APIRequestContext, serialId: string): Promise<void> {
    await request.post('/api/inventory/serial-numbers/close-consignment', {
      data: { serialNumberIds: [serialId] },
    })
  }

  async function findBranchId(request: APIRequestContext, name: string): Promise<string> {
    const res = await request.get('/api/branches?limit=200')
    const body = await res.json()
    const branch = (body?.data ?? []).find((b: { name: string }) => b.name === name)
    if (!branch) throw new Error(`Branch "${name}" not found — check seed data`)
    return branch.id as string
  }

  test('consigns a serial to Cebu, selects it in the Caravan tab, and returns it to origin', async ({
    page,
    request,
  }) => {
    const { id: serialId, serialNumber: SERIAL_NUMBER } = await findAvailableSerial(request)
    const cebuBranchId = await findBranchId(request, 'Cebu Office')

    try {
      await gotoReady(page, '/inventory/serial-numbers')
      await expect(page.getByRole('heading', { name: 'Serial Number Tracking' })).toBeVisible({
        timeout: 15_000,
      })

      await page.getByRole('button', { name: 'Caravan @ Host' }).click()

      // Branch picker is a SearchableSelect (type-ahead), identified by its
      // placeholder text rather than a native <select>'s options — typing
      // filters its floating option list down to a single match to click.
      const branchPicker = page.getByPlaceholder('Select a branch…')
      await expect(branchPicker).toBeVisible()

      const consignRes = await request.post('/api/inventory/serial-numbers/consign', {
        data: { serialNumberIds: [serialId], hostBranchId: cebuBranchId },
      })
      expect(consignRes.ok()).toBe(true)

      await branchPicker.click()
      await branchPicker.fill('Cebu Office')
      await page.locator('div.absolute.z-50 button', { hasText: 'Cebu Office' }).click()

      const row = page.getByRole('row').filter({ hasText: SERIAL_NUMBER })
      await expect(row).toBeVisible({ timeout: 10_000 })

      await row.getByRole('checkbox').check()
      await expect(page.getByText('1 selected')).toBeVisible()

      await page.getByRole('button', { name: 'Return to Origin' }).click()

      await expect(row).toHaveCount(0, { timeout: 10_000 })
      await expect(page.getByText('1 selected')).toHaveCount(0)
    } finally {
      // Safety net: guarantee the serial is back at origin even if an
      // assertion above failed mid-test, so no run leaves permanent debris.
      await returnToOrigin(request, serialId)
    }
  })
})
