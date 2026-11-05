import { test, expect } from '@playwright/test'
import { gotoReady, clickStable, pickSearchableOption, confirmCountAction } from './utils'

// Scenario 87 Part 3 — the Physical Inventory Count Sheet, laid out like the
// client's form: Serial Number · Brand · Model · In Store? · Remarks (a preset
// tag plus free text). One unit is ticked in store with "Found on main shelf";
// the other is left unticked with "Defective" and its location / ref. no.
// Both remarks must be on the count's lines after Submit Count.
// Backend coverage: backend/test/scenario-87-part-3-count-sheet-remarks.e2e-spec.ts.
//
// Uses a fresh warehouse and freshly registered serials (start() snapshots
// the whole warehouse), like inventory-serial-level-counting.spec.ts. As
// there, a submitted count has no UI delete path, so its rows stay.
test.describe('Scenario 87 Part 3 — Count Sheet', () => {
  test('ticks In Store?, records remarks, and submits them', async ({ page }) => {
    const warehouseCode = `E2E-S87P3-${Date.now()}`
    // Unique, so the Location picker's exact match can't hit an older run's.
    const warehouseName = `E2E S87 Count Sheet Warehouse ${warehouseCode}`
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

    const shelfSerial = `E2E-S87-SHELF-${Date.now()}`
    const awaySerial = `E2E-S87-AWAY-${Date.now()}`
    const registerRes = await page.request.post('/api/inventory/serial-numbers', {
      data: {
        itemId: item.id,
        warehouseId: warehouse.id,
        serialNumbers: [shelfSerial, awaySerial],
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

    for (const header of ['Serial Number', 'Brand', 'Model', 'In Store?', 'Remarks']) {
      await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible()
    }

    // Scan to tick (Part 3b): the serial and Enter — what a barcode scanner
    // sends — ticks it and clears the box for the next one.
    const scanBox = page.getByLabel('Scan or search the count sheet')
    await scanBox.fill(shelfSerial)
    await scanBox.press('Enter')
    await expect(page.getByLabel(`In store: ${shelfSerial}`)).toBeChecked()
    await expect(scanBox).toHaveValue('')
    await expect(page.getByRole('status').filter({ hasText: 'In store:' })).toBeVisible()
    // Scanning it again doesn't count it twice.
    await scanBox.fill(shelfSerial)
    await scanBox.press('Enter')
    await expect(page.getByRole('status').filter({ hasText: 'Already counted' })).toBeVisible()

    // Remarks is free text with the presets offered as you type: search
    // "shelf", pick the suggestion.
    const shelfRemarks = page.getByRole('combobox', { name: `Remarks: ${shelfSerial}` })
    await shelfRemarks.fill('shelf')
    await page.getByTestId('remark-suggestion').filter({ hasText: 'Found on main shelf' }).click()
    await expect(shelfRemarks).toHaveValue('Found on main shelf')

    // Pick a preset, then keep typing the location and ref. no. after it.
    const awayRemarks = page.getByRole('combobox', { name: `Remarks: ${awaySerial}` })
    await awayRemarks.fill('def')
    await page.getByTestId('remark-suggestion').filter({ hasText: 'Defective' }).click()
    await awayRemarks.press('End')
    await awayRemarks.pressSequentially(' — Service bay, DR-10293')
    await expect(awayRemarks).toHaveValue('Defective — Service bay, DR-10293')

    // The search bar narrows the sheet without losing what was entered.
    const search = scanBox
    await search.fill(awaySerial)
    await expect(page.getByLabel(`In store: ${shelfSerial}`)).toHaveCount(0)
    await expect(awayRemarks).toHaveValue('Defective — Service bay, DR-10293')
    await search.fill('')
    await expect(page.getByLabel(`In store: ${shelfSerial}`)).toBeChecked()
    await expect(page.getByLabel(`In store: ${awaySerial}`)).not.toBeChecked()

    // Save as you go (Part 3b): the tick and the remark are on the server
    // before anything is submitted.
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 })
    const openCounts = await page.request.get(
      `/api/inventory/counts?warehouseId=${warehouse.id}&limit=5`
    )
    const [openCount] = ((await openCounts.json()).data ?? []) as { id: string }[]
    const savedRes = await page.request.get(`/api/inventory/counts/${openCount.id}/lines`)
    const saved = (await savedRes.json()) as {
      serialNumber: { serialNumber: string } | null
      countedQty: string | null
      remarks: string | null
    }[]
    const savedBySerial = new Map(saved.map((l) => [l.serialNumber?.serialNumber, l]))
    expect(Number(savedBySerial.get(shelfSerial)!.countedQty)).toBe(1)
    expect(savedBySerial.get(awaySerial)!.remarks).toBe('Defective — Service bay, DR-10293')

    await confirmCountAction(page, 'Submit Count', 'Physical inventory submitted')

    const countsRes = await page.request.get(
      `/api/inventory/counts?warehouseId=${warehouse.id}&limit=5`
    )
    const [count] = ((await countsRes.json()).data ?? []) as { id: string }[]
    const linesRes = await page.request.get(`/api/inventory/counts/${count.id}/lines`)
    const lines = (await linesRes.json()) as {
      serialNumber: { serialNumber: string } | null
      countedQty: string | null
      remarkTag: string | null
      remarks: string | null
    }[]
    const bySerial = new Map(lines.map((l) => [l.serialNumber?.serialNumber, l]))
    expect(bySerial.get(shelfSerial)).toMatchObject({ remarkTag: 'found_on_main_shelf' })
    expect(Number(bySerial.get(shelfSerial)!.countedQty)).toBe(1)
    expect(bySerial.get(awaySerial)).toMatchObject({
      remarkTag: 'defective',
      remarks: 'Defective — Service bay, DR-10293',
    })
    expect(Number(bySerial.get(awaySerial)!.countedQty)).toBe(0)
  })
})
