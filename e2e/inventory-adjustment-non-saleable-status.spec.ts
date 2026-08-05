import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Scenario 19, Part 4 — surfacing existing SerialNumberStatus/BatchStatus in
// the count/adjustment UI (no new status field). Batch-side coverage lives
// in backend/test/inventory-stock-adjustment-approval-chain.e2e-spec.ts
// (no batch-tracked item exists in the seed data to drive this from the UI);
// this spec covers the serial-tracked path end to end.
test.describe('Inventory — Adjustment Non-Saleable Status (Scenario 19, Part 4)', () => {
  test('selecting a defective serial on an adjustment line shows a non-saleable badge', async ({
    page,
  }) => {
    // Fixture: a fresh serial on a real serial-tracked item, flipped to
    // 'defective' via the API — isolated from other specs' own serials.
    const branchesRes = await page.request.get('/api/branches?limit=200')
    const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
    const branch = branches[0]

    const warehousesRes = await page.request.get('/api/inventory/warehouses?limit=200')
    const warehouses = ((await warehousesRes.json()).data ?? []) as {
      id: string
      branchId: string | null
    }[]
    const warehouse = warehouses.find((w) => w.branchId === branch.id)
    if (!warehouse) throw new Error('No warehouse found for the first branch')

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

    const serialNumber = `E2E-NONSALE-${Date.now()}`
    const registerRes = await page.request.post('/api/inventory/serial-numbers', {
      data: { itemId: item.id, warehouseId: warehouse.id, serialNumbers: [serialNumber] },
    })
    if (!registerRes.ok()) {
      throw new Error(`Failed to register serial: ${await registerRes.text()}`)
    }
    // register() returns the raw array of created records for small batches
    // (backend/src/inventory/services/serial-numbers.service.ts) — not
    // wrapped in { data: [...] } like the paginated list endpoint.
    const registered = (await registerRes.json()) as { id: string }[]
    const serialId = registered[0].id

    const statusRes = await page.request.patch(`/api/inventory/serial-numbers/${serialId}/status`, {
      data: { status: 'defective' },
    })
    if (!statusRes.ok()) {
      throw new Error(`Failed to mark serial defective: ${await statusRes.text()}`)
    }

    // Now drive the actual UI: open a count session's Create Adjustment tab.
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

    const freshRow = page.locator('tr').filter({ hasText: 'Scheduled' })
    const sessionId = await freshRow.locator('td').first().innerText()
    const ownRow = page.locator('tr').filter({ hasText: sessionId })

    const sessionHeading = page.getByRole('heading', { name: 'Count Session' })
    await clickStable(ownRow, sessionHeading)

    await expect(async () => {
      await page.getByRole('button', { name: 'Start Count' }).click()
      await expect(page.getByText('Count started').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })

    const adjustTabButton = page.getByRole('button', { name: 'Create Adjustment' })
    await expect(adjustTabButton).toBeVisible({ timeout: 10_000 })
    await adjustTabButton.click()

    await page.getByRole('button', { name: 'Add Line' }).click()
    const lineRow = page.locator('.rounded-lg.border.border-zinc-100').last()

    const itemSelect = lineRow
      .locator('select')
      .filter({ has: page.locator('option', { hasText: 'Select item' }) })
    await itemSelect.selectOption({ value: item.id })

    const serialSelect = lineRow
      .locator('select')
      .filter({ has: page.locator('option', { hasText: 'Select serial' }) })
    await expect(serialSelect).toBeVisible({ timeout: 5_000 })
    await serialSelect.selectOption({ value: serialId })

    await expect(lineRow.getByText('Non-saleable — Defective')).toBeVisible({ timeout: 5_000 })
  })
})
