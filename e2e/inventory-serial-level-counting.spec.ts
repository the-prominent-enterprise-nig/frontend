import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Scenario 19, Part 5 — serial-tracked items get one count-sheet line per
// physically expected unit instead of a single aggregate quantity line.
// Backend coverage lives in
// backend/test/inventory-serial-level-counting.e2e-spec.ts; this covers the
// checklist UI itself — the serial badge, the same numeric "Counted" field
// every other line uses (1 for found, blank for not found), and that a
// blank expected serial line still submits (to be swept as missing
// server-side).
//
// Uses a fresh, dedicated warehouse and freshly-registered serials, never
// WH-01/02/03 — those shared dev warehouses carry ~1000 real serials each,
// and start()/submit() now reconcile every serial physically in the target
// warehouse (see inventory-stock-count-snapshot.spec.ts for the same fix).
test.describe('Inventory — Serial-Level Counting (Scenario 19, Part 5)', () => {
  test('expected serial lines show the serial number badge and use the same numeric Counted field', async ({
    page,
  }) => {
    const warehouseCode = `E2E-CNT19P5-${Date.now()}`
    const createWarehouseRes = await page.request.post('/api/inventory/warehouses', {
      data: { code: warehouseCode, name: 'E2E Isolated Serial Count Warehouse' },
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

    await gotoReady(page, '/inventory/counting')

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

    const countSheetTab = page.getByRole('button', { name: 'Count Sheet' })
    await expect(async () => {
      await page.getByRole('button', { name: 'Start Count' }).click()
      await expect(page.getByText('Count started').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })

    await expect(countSheetTab).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Loading snapshot…')).toHaveCount(0, { timeout: 10_000 })

    // Two serial-level lines, each showing its own serial number badge and
    // the same numeric "Counted" field every other line uses — blank by
    // default, since neither has been counted yet.
    const presentRow = page.locator('.grid-cols-12').filter({ hasText: presentSerial })
    const missingRow = page.locator('.grid-cols-12').filter({ hasText: missingSerial })
    await expect(presentRow).toBeVisible()
    await expect(missingRow).toBeVisible()
    const presentCountedInput = presentRow.locator('input[placeholder="Counted"]')
    await expect(presentCountedInput).toHaveValue('')

    // Count only the present one (expected 1, counted 1 — no variance) —
    // the missing one stays blank and is simply not part of the submitted
    // payload (the backend sweeps any still-unresolved serial line as
    // missing on submit()).
    await presentCountedInput.fill('1')
    await expect(presentCountedInput).toHaveValue('1')
    await expect(presentRow.getByText('+0', { exact: true })).toBeVisible()
    await expect(missingRow.locator('input[placeholder="Counted"]')).toHaveValue('')

    await expect(async () => {
      await page.getByRole('button', { name: 'Submit Count' }).click()
      await expect(page.getByText('Count submitted').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })
  })
})
