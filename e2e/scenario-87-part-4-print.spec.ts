import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 87 Part 4 — a completed physical inventory prints as the client's
// Monthly Physical Inventory (note, certification, sign-off) followed by its
// Stock Count Sheet: a ticked unit ☑, an unticked one ☐ with its remark, and
// an unticked one with no remark flagged UNACCOUNTED.
//
// The count is built and submitted through the API on a fresh warehouse with
// freshly registered serials (start() snapshots the whole warehouse). A
// submitted count has no UI delete path, so its rows stay — same trade-off as
// the other count specs.
test.describe('Scenario 87 Part 4 — Physical Inventory printout', () => {
  test('a completed count prints the cover and the Stock Count Sheet', async ({ page }) => {
    const code = `E2E-S87P4-${Date.now()}`
    const whRes = await page.request.post('/api/inventory/warehouses', {
      data: { code, name: `E2E S87 Print Warehouse ${code}` },
    })
    const warehouse = (await whRes.json()) as { id: string }

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

    const serials = ['IN', 'AWAY', 'LOST'].map((k) => `E2E-S87P4-${k}-${Date.now()}`)
    await page.request.post('/api/inventory/serial-numbers', {
      data: { itemId: item.id, warehouseId: warehouse.id, serialNumbers: serials },
    })

    const created = await page.request.post('/api/inventory/counts', {
      data: { warehouseId: warehouse.id, countType: 'full', scheduledDate: '2026-11-05' },
    })
    const count = (await created.json()) as { id: string }
    await page.request.patch(`/api/inventory/counts/${count.id}/start`)
    const linesRes = await page.request.get(`/api/inventory/counts/${count.id}/lines`)
    const lines = (await linesRes.json()) as {
      serialNumberId: string
      serialNumber: { serialNumber: string }
    }[]
    const idOf = (serial: string): string =>
      lines.find((l) => l.serialNumber.serialNumber === serial)!.serialNumberId
    const submitted = await page.request.post(`/api/inventory/counts/${count.id}/submit`, {
      data: {
        lines: [
          { itemId: item.id, serialNumberId: idOf(serials[0]), countedQty: 1 },
          {
            itemId: item.id,
            serialNumberId: idOf(serials[1]),
            countedQty: 0,
            remarkTag: 'defective',
            remarks: 'Defective — Service bay, DR-10293',
          },
          { itemId: item.id, serialNumberId: idOf(serials[2]), countedQty: 0 },
        ],
      },
    })
    expect(submitted.ok()).toBe(true)

    await gotoReady(page, '/inventory/reports?tab=physical-inventory')
    const row = page.locator('tbody tr').filter({ hasText: count.id.slice(0, 8).toUpperCase() })
    await expect(row).toBeVisible({ timeout: 20_000 })

    const [printout] = await Promise.all([
      page.waitForEvent('popup'),
      row.getByRole('button', { name: 'Print physical inventory' }).click(),
    ])
    await expect(printout.getByRole('heading', { name: 'MONTHLY PHYSICAL INVENTORY' })).toBeVisible(
      {
        timeout: 20_000,
      }
    )
    await expect(printout.getByText('PREPARED BY:')).toBeVisible()
    await expect(printout.getByRole('heading', { name: 'STOCK COUNT SHEET' })).toBeVisible()

    const sheetRow = (serial: string) =>
      printout.locator('table.sheet tr').filter({ hasText: serial })
    await expect(sheetRow(serials[0])).toContainText('☑')
    await expect(sheetRow(serials[1])).toContainText('Defective — Service bay, DR-10293')
    await expect(sheetRow(serials[2])).toContainText('UNACCOUNTED')
    await printout.close()
  })
})
