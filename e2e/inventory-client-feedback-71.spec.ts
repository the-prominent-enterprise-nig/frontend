import { test, expect, type Locator, type Page } from '@playwright/test'
import {
  gotoReady,
  fillStable,
  clickStable,
  cancelStockTransfer,
  pickComboboxOption,
} from './utils'

// Scenario 71 — inventory client feedback batch, UI side. Backend
// correctness (orderDate on create/update/convert, '' location → null) is
// covered by backend/test/inventory-client-feedback-71.e2e-spec.ts.
// Self-cleaning: cancels every PO it creates (no hard delete via the API).

test.describe('Scenario 71 — Part 1: PO Date and optional Location', () => {
  test('Edit PO shows an optional Location and a settable PO Date that saves', async ({ page }) => {
    const suppliersRes = await page.request.get('/api/suppliers?limit=1')
    const supplier = ((await suppliersRes.json()).data ?? [])[0] as { id: string }

    const itemsRes = await page.request.get('/api/inventory/items', { params: { limit: '1' } })
    const item = ((await itemsRes.json()).data ?? [])[0] as { id: string }

    // A drop-ship PO: no location at all.
    const poRes = await page.request.post('/api/procurement/purchase-orders', {
      data: {
        supplierId: supplier.id,
        orderDate: '2026-10-02',
        deliveryInstructions: 'Deliver to the customer site',
        lines: [{ itemId: item.id, quantity: 1, unitPrice: 100 }],
      },
    })
    expect(poRes.ok()).toBeTruthy()
    const po = (await poRes.json()) as { id: string; code: string; warehouseId: string | null }
    expect(po.warehouseId).toBeNull()

    try {
      await gotoReady(page, '/inventory/purchase-orders')
      const row = page.getByRole('row').filter({ hasText: po.code })
      await expect(row).toBeVisible({ timeout: 15_000 })

      await row.locator('button:has(svg.lucide-pencil)').click()
      await expect(page.getByRole('heading', { name: 'Edit Purchase Order' })).toBeVisible({
        timeout: 10_000,
      })

      // Location carries no required marker any more.
      const locationLabel = page.locator('label', { hasText: /^Location/ })
      await expect(locationLabel).toBeVisible()
      await expect(locationLabel.locator('span', { hasText: '*' })).toHaveCount(0)

      const poDate = page.locator('input[type="date"]')
      await expect(poDate).toHaveValue('2026-10-02')
      await fillStable(poDate, '2026-10-03')

      await page.getByRole('button', { name: 'Save Changes' }).click()
      await expect(page.getByRole('heading', { name: 'Edit Purchase Order' })).toHaveCount(0, {
        timeout: 10_000,
      })

      const after = await (
        await page.request.get(`/api/procurement/purchase-orders/${po.id}`)
      ).json()
      expect(String(after.orderDate).slice(0, 10)).toBe('2026-10-03')
      expect(after.warehouseId).toBeNull()
    } finally {
      await page.request.patch(`/api/procurement/purchase-orders/${po.id}/cancel`, {
        data: { reason: 'E2E test cleanup' },
      })
    }
  })

  test('New Stock Request form has a PO Date field defaulting to today', async ({ page }) => {
    await gotoReady(page, '/inventory/purchase-orders?tab=requests')
    await clickStable(
      page.getByRole('button', { name: /New Stock Request/ }).first(),
      page.getByRole('heading', { name: 'New Purchase Request' })
    )
    await expect(page.locator('label', { hasText: 'PO Date' })).toBeVisible()
    await expect(page.locator('input[type="date"]')).toHaveValue(
      new Date().toLocaleDateString('en-CA')
    )
  })

  test('Receiving a PO with no location shows its delivery instructions and is blocked', async ({
    page,
  }) => {
    const supplier = ((await (await page.request.get('/api/suppliers?limit=1')).json()).data ??
      [])[0] as { id: string }
    const itemsRes = await page.request.get('/api/inventory/items', { params: { limit: '1' } })
    const item = ((await itemsRes.json()).data ?? [])[0] as { id: string }

    const poRes = await page.request.post('/api/procurement/purchase-orders', {
      data: {
        supplierId: supplier.id,
        deliveryInstructions: 'Please deliver to Brgy. Igang, Pototan Covered Gym',
        lines: [{ itemId: item.id, quantity: 1, unitPrice: 100 }],
      },
    })
    expect(poRes.ok()).toBeTruthy()
    const po = (await poRes.json()) as { id: string; code: string }

    try {
      const approved = await page.request.patch(`/api/procurement/purchase-orders/${po.id}/approve`)
      expect(approved.ok()).toBeTruthy()
      const sent = await page.request.patch(`/api/procurement/purchase-orders/${po.id}/send`)
      expect(sent.ok()).toBeTruthy()

      await gotoReady(page, '/inventory/purchase-orders')
      const search = page.getByPlaceholder(/search/i).first()
      await expect(search).toBeVisible({ timeout: 20_000 })
      await fillStable(search, po.code)
      const receive = page.getByRole('button', { name: /^Receive( stock)?$/ })
      await expect(receive.first()).toBeVisible({ timeout: 20_000 })
      await receive.first().click()
      await expect(page.getByRole('heading', { name: 'Receive stock against PO' })).toBeVisible({
        timeout: 15_000,
      })

      // Destination is the PO's own delivery instructions, read-only, with
      // no location picker — and receiving is blocked until drop-ship
      // booking is decided (deferred).
      await expect(
        page.getByText('Please deliver to Brgy. Igang, Pototan Covered Gym')
      ).toBeVisible()
      await expect(page.locator('select', { hasText: 'Select location…' })).toHaveCount(0)
      await expect(
        page.getByText("receiving it isn't available yet", { exact: false })
      ).toBeVisible()
    } finally {
      // A sent PO can't be cancelled — close() is its only way out.
      const cancelled = await page.request.patch(
        `/api/procurement/purchase-orders/${po.id}/cancel`,
        { data: { reason: 'E2E test cleanup' } }
      )
      if (!cancelled.ok()) {
        await page.request.patch(`/api/procurement/purchase-orders/${po.id}/close`, {
          data: { reason: 'E2E test cleanup' },
        })
      }
    }
  })

  test('Send is refused for a PO with neither a Location nor Delivery instructions', async ({
    page,
  }) => {
    const supplier = ((await (await page.request.get('/api/suppliers?limit=1')).json()).data ??
      [])[0] as { id: string }
    const itemsRes = await page.request.get('/api/inventory/items', { params: { limit: '1' } })
    const item = ((await itemsRes.json()).data ?? [])[0] as { id: string }

    // Saving a draft with neither is allowed — only sending is not.
    const poRes = await page.request.post('/api/procurement/purchase-orders', {
      data: { supplierId: supplier.id, lines: [{ itemId: item.id, quantity: 1, unitPrice: 100 }] },
    })
    expect(poRes.ok()).toBeTruthy()
    const po = (await poRes.json()) as { id: string; code: string }

    try {
      const approved = await page.request.patch(`/api/procurement/purchase-orders/${po.id}/approve`)
      expect(approved.ok()).toBeTruthy()

      await gotoReady(page, '/inventory/purchase-orders')
      const search = page.getByPlaceholder(/search/i).first()
      await expect(search).toBeVisible({ timeout: 20_000 })
      await fillStable(search, po.code)
      const send = page.getByRole('button', { name: 'Send to Supplier' })
      await expect(send.first()).toBeVisible({ timeout: 20_000 })
      await send.first().click()

      await expect(page.getByText('Add a destination before sending')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Send to Supplier' })).toHaveCount(0)
      const after = await (
        await page.request.get(`/api/procurement/purchase-orders/${po.id}`)
      ).json()
      expect(after.status).toBe('approved')
    } finally {
      await page.request.patch(`/api/procurement/purchase-orders/${po.id}/cancel`, {
        data: { reason: 'E2E test cleanup' },
      })
    }
  })

  test('the new request form shows no destination warning', async ({ page }) => {
    await gotoReady(page, '/inventory/purchase-orders?tab=requests')
    await clickStable(
      page.getByRole('button', { name: /New Stock Request/ }).first(),
      page.getByRole('heading', { name: 'New Purchase Request' })
    )
    const warning = page.getByText('Where should this be delivered?')
    await expect(warning).toHaveCount(0)
    // Still none once the buyer starts filling it in: a new request can be
    // given its destination later.
    await fillStable(page.locator('input[type="date"]'), '2026-10-01')
    await expect(warning).toHaveCount(0)
  })
})

/** Creates and accepts a 2-unit serial-tracked transfer, opens its detail
 * drawer, and returns the drawer plus the transfer id (to cancel after). */
async function openAcceptedSerialTransfer(
  page: Page,
  /** Runs after accept, before the drawer opens — to move it further along. */
  beforeOpen?: (t: { id: string; fromId: string; itemId: string }) => Promise<void>
): Promise<{ transferId: string; modal: Locator }> {
  const reason = `E2E-S71-DISPATCH-${Date.now()}`
  const warehouses = ((
    await (await page.request.get('/api/inventory/warehouses?limit=200&status=active')).json()
  ).data ?? []) as { id: string; branchId: string | null }[]
  const branchWarehouses = warehouses.filter((w) => w.branchId)

  // A source with ≥2 in-stock serials of one item — not a fixed SKU, same
  // approach as inventory-transfer-dispatch-multiselect.spec.ts.
  let fromId: string | undefined
  let itemId: string | undefined
  for (const w of branchWarehouses) {
    const serials = ((
      await (
        await page.request.get('/api/inventory/serial-numbers', {
          params: { warehouseId: w.id, status: 'in_stock', limit: '200' },
        })
      ).json()
    ).data ?? []) as { itemId: string }[]
    const counts = new Map<string, number>()
    for (const sn of serials) counts.set(sn.itemId, (counts.get(sn.itemId) ?? 0) + 1)
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    if (best && best[1] >= 2) {
      fromId = w.id
      itemId = best[0]
      break
    }
  }
  expect(fromId, 'a warehouse with ≥2 in-stock serials of one item').toBeTruthy()
  const toId = branchWarehouses.find((w) => w.id !== fromId)!.id

  const createRes = await page.request.post('/api/inventory/transfers', {
    data: {
      fromWarehouseId: fromId,
      toWarehouseId: toId,
      transferDate: new Date().toISOString().split('T')[0],
      reason,
      lines: [
        { itemId, quantity: 1 },
        { itemId, quantity: 1 },
      ],
    },
  })
  expect(createRes.ok(), await createRes.text()).toBeTruthy()
  const transfer = (await createRes.json()) as { id: string }

  expect(
    (await page.request.patch(`/api/inventory/transfers/${transfer.id}/accept`, { data: {} })).ok()
  ).toBeTruthy()
  if (beforeOpen) await beforeOpen({ id: transfer.id, fromId: fromId!, itemId: itemId! })

  await gotoReady(page, '/inventory/transfers')
  await expect(async () => {
    await page.locator('tbody tr').first().click()
    await expect(page.getByRole('heading', { name: 'Transfer Details' })).toBeVisible({
      timeout: 3_000,
    })
    if (
      !(await page
        .getByText(reason, { exact: true })
        .isVisible()
        .catch(() => false))
    ) {
      await page.getByRole('button', { name: 'Close dialog' }).click()
      throw new Error('opened transfer is not the one just created — retrying')
    }
  }).toPass({ timeout: 20_000 })
  const modal = page.locator('.fixed.inset-0.z-50')
  return { transferId: transfer.id, modal }
}

test.describe('Scenario 71 — Part 4: dispatch legibility', () => {
  test('serials show pre-dispatch, the picker carries ages, pills are legible, the drawer is wider', async ({
    page,
  }) => {
    const { transferId, modal } = await openAcceptedSerialTransfer(page)
    try {
      // Item 21 — wider than the old 860px cap (viewport is 1280px).
      const panel = modal.locator('div.max-w-\\[min\\(1200px\\,96vw\\)\\]').first()
      expect((await panel.boundingBox())!.width).toBeGreaterThan(900)

      // Item 19 — pre-dispatch, the Serial column is there and says why
      // it's blank.
      await expect(modal.getByText('Assigned at dispatch').first()).toBeVisible()

      await clickStable(
        modal.getByRole('button', { name: 'Dispatch' }),
        modal.getByRole('button', { name: 'Confirm Dispatch' }),
        { timeout: 15_000 }
      )

      // Item 17 — each serial option carries its inbound age beside it.
      const picker = modal.getByPlaceholder('Search serial number…')
      await picker.click()
      const option = page.locator('[data-testid="searchable-select-option"]').first()
      await expect(option).toBeVisible({ timeout: 10_000 })
      await expect(option).toContainText(/Inbound \S/)
      await option.click()
      await page.keyboard.press('Escape')

      // Item 20 — the assigned pill is near-black and monospaced.
      const pill = modal.locator('span.rounded-full.font-mono.bg-prominent-purple-50').first()
      await expect(pill).toBeVisible()
      await expect(pill).toHaveCSS('color', 'rgb(23, 23, 28)')
    } finally {
      await cancelStockTransfer(page.request, transferId)
    }
  })
})

test.describe('Scenario 71 — Part 5: driver and vehicle are separate', () => {
  test('a driver pick fills the driver only, a vehicle pick fills the plate only', async ({
    page,
  }) => {
    const { transferId, modal } = await openAcceptedSerialTransfer(page)
    try {
      await clickStable(
        modal.getByRole('button', { name: 'Dispatch' }),
        modal.getByRole('button', { name: 'Confirm Dispatch' }),
        { timeout: 15_000 }
      )
      const driver = modal.getByPlaceholder('e.g. Juan dela Cruz')
      const plate = modal.getByPlaceholder('e.g. ABC 1234')

      // The roster dropdowns are portalled to <body> (VehicleAutocompleteInput).
      const firstOption = page.locator('div.fixed.max-h-56 button').first()

      // Driver Name lists driver names; a pick fills the driver only.
      await driver.click()
      await expect(firstOption).toBeVisible({ timeout: 10_000 })
      const driverName = (await firstOption.innerText()).trim()
      await firstOption.click()
      await expect(driver).toHaveValue(driverName)
      await expect(plate).toHaveValue('')

      // Vehicle Plate lists plates; a pick fills the plate only.
      await plate.click()
      await expect(firstOption).toBeVisible({ timeout: 10_000 })
      await firstOption.click()
      await expect(plate).not.toHaveValue('')
      await expect(driver).toHaveValue(driverName)
    } finally {
      await cancelStockTransfer(page.request, transferId)
    }
  })
})

/** Dispatches an accepted serial transfer through the API, assigning the
 * source's first free in-stock units; returns its line ids. */
async function dispatchByApi(
  page: Page,
  { id, fromId, itemId }: { id: string; fromId: string; itemId: string }
): Promise<string[]> {
  const detail = await (await page.request.get(`/api/inventory/transfers/${id}`)).json()
  const lineIds = (detail.lines as { id: string }[]).map((l) => l.id)
  const serials = ((
    await (
      await page.request.get('/api/inventory/serial-numbers', {
        params: {
          warehouseId: fromId,
          itemId,
          status: 'in_stock',
          freeForTransfer: 'true',
          limit: '2',
        },
      })
    ).json()
  ).data ?? []) as { id: string }[]
  const dispatched = await page.request.patch(`/api/inventory/transfers/${id}/dispatch`, {
    data: {
      vehiclePlate: 'E2E 071',
      carrierName: 'E2E Carrier',
      serialAssignments: lineIds.map((lineId, i) => ({
        lineId,
        serialNumberId: serials[i].id,
      })),
    },
  })
  expect(dispatched.ok(), await dispatched.text()).toBeTruthy()
  return lineIds
}

test.describe('Scenario 71 — partial receive leaves the rest in transit', () => {
  // Not self-cleaning: a dispatched/received transfer is a real stock
  // movement and can't be cancelled — same tradeoff
  // inventory-transfer-dispatch-multiselect.spec.ts documents.
  test('a unit left unticked shows "Not received yet", not "Lost in Transit"', async ({ page }) => {
    const { modal } = await openAcceptedSerialTransfer(page, async (t) => {
      const lineIds = await dispatchByApi(page, t)
      const id = t.id
      const received = await page.request.patch(`/api/inventory/transfers/${id}/receive`, {
        data: {
          receivedDate: new Date().toISOString().split('T')[0],
          deliveryReceiptNumber: 'DR-E2E-071',
          lines: [
            { stockTransferLineId: lineIds[0], quantityReceived: 1 },
            { stockTransferLineId: lineIds[1], quantityReceived: 0 },
          ],
        },
      })
      expect(received.ok(), await received.text()).toBeTruthy()
    })

    await expect(modal.getByText('Not received yet')).toBeVisible({ timeout: 10_000 })
    await expect(modal.getByText('Lost in Transit')).toHaveCount(0)
  })
})

test.describe('Scenario 71 — Part 6: receive defaults and Create Transfer copy', () => {
  // Leaves one dispatched (in-transit) transfer behind — can't be cancelled.
  test('serials start unticked, an empty receipt is refused, Mark all ticks them', async ({
    page,
  }) => {
    const { modal } = await openAcceptedSerialTransfer(page, async (t) => {
      await dispatchByApi(page, t)
    })
    await clickStable(
      modal.getByRole('button', { name: 'Receive' }),
      modal.getByRole('button', { name: 'Confirm Receipt' }),
      { timeout: 15_000 }
    )
    const boxes = modal.locator('input[type="checkbox"]')
    await expect(boxes).toHaveCount(2)
    for (const box of await boxes.all()) await expect(box).not.toBeChecked()

    await modal.getByRole('button', { name: 'Confirm Receipt' }).click()
    await expect(modal.getByText('Tick at least one unit')).toBeVisible()

    await modal.getByRole('button', { name: 'Mark all received' }).click()
    for (const box of await boxes.all()) await expect(box).toBeChecked()
  })

  test('the Create Transfer item search no longer claims to search serials', async ({ page }) => {
    await gotoReady(page, '/inventory/transfers')
    await clickStable(
      page.getByRole('button', { name: /New transfer/i }).first(),
      page.getByRole('heading', { name: 'New Stock Transfer' })
    )
    // SearchCombobox renders its placeholder as text, not an attribute.
    await expect(page.getByText('Add item — search name or SKU…')).toBeVisible()
    await expect(page.getByText(/search name, SKU, or serial/)).toHaveCount(0)
  })
})

test.describe('Scenario 71 — Part 8: PO item search follows the supplier', () => {
  test("lists the supplier's items, tags off-list ones", async ({ page }) => {
    const supplier = ((await (await page.request.get('/api/suppliers?limit=1')).json()).data ??
      [])[0] as { id: string; name: string }
    const items = ((
      await (await page.request.get('/api/inventory/items', { params: { limit: '2' } })).json()
    ).data ?? []) as { id: string; sku: string }[]
    const [onList, offList] = items

    const linked = await page.request.post(`/api/suppliers/${supplier.id}/items`, {
      data: { itemId: onList.id },
    })
    expect(linked.ok(), await linked.text()).toBeTruthy()

    try {
      await gotoReady(page, '/inventory/purchase-orders?tab=requests')
      await clickStable(
        page.getByRole('button', { name: /New Stock Request/ }).first(),
        page.getByRole('heading', { name: 'New Purchase Request' })
      )
      await page
        .getByRole('button', { name: /Search supplier/ })
        .first()
        .click()
      const supplierInput = page.locator('input[placeholder*="Search supplier"]')
      await supplierInput.fill(supplier.name)
      await page
        .locator('div.fixed.z-100 button')
        .filter({ hasText: supplier.name })
        .first()
        .click()

      await page
        .getByRole('button', { name: /to add a line/ })
        .first()
        .click()
      const itemInput = page.locator('input[placeholder*="to add a line"]')
      const list = page.locator('div.fixed.z-100')

      await itemInput.fill(onList.sku)
      const own = list.locator('button').filter({ hasText: onList.sku }).first()
      await expect(own).toBeVisible({ timeout: 10_000 })
      await expect(own).not.toContainText("Not on supplier's list")

      await itemInput.fill(offList.sku)
      const other = list.locator('button').filter({ hasText: offList.sku }).first()
      await expect(other).toBeVisible({ timeout: 10_000 })
      await expect(other).toContainText("Not on supplier's list")
    } finally {
      await page.request.delete(`/api/suppliers/${supplier.id}/items/${onList.id}`)
    }
  })
})

test.describe('Scenario 71 — item 18: units ticked in the General Stockbook', () => {
  test('are not asked for again at dispatch', async ({ page }) => {
    // A free in-stock unit at a branch — what the stockbook lets you tick.
    const warehouses = ((
      await (await page.request.get('/api/inventory/warehouses?limit=200&status=active')).json()
    ).data ?? []) as { id: string; branchId: string | null }[]
    let serial: { id: string; serialNumber: string } | undefined
    for (const w of warehouses.filter((x) => x.branchId)) {
      const rows = ((
        await (
          await page.request.get('/api/inventory/serial-numbers', {
            params: { warehouseId: w.id, status: 'in_stock', freeForTransfer: 'true', limit: '1' },
          })
        ).json()
      ).data ?? []) as { id: string; serialNumber: string }[]
      if (rows[0]) {
        serial = rows[0]
        break
      }
    }
    expect(serial, 'a free in-stock unit at a branch').toBeTruthy()
    const reason = `E2E-S71-STOCKBOOK-${Date.now()}`

    await gotoReady(page, '/inventory/serial-numbers')
    // The list's search box can be reset by a late hydration pass — retry
    // the fill until the unit's own row (and its checkbox) actually shows.
    const searchBox = page.getByPlaceholder(
      'Search serial, brand, model, category, RR or supplier…'
    )
    const tick = page.getByRole('checkbox', { name: `Select ${serial!.serialNumber}` })
    await expect(async () => {
      await searchBox.fill(serial!.serialNumber)
      await expect(tick).toBeVisible({ timeout: 4_000 })
    }).toPass({ timeout: 30_000 })
    await tick.check()
    // Navigates to Transfers with the ticked unit as a draft — a plain click,
    // since the button is gone once the page changes (clickStable re-clicks).
    await page.getByRole('button', { name: 'Stock Transfer' }).click()
    await expect(page.getByRole('heading', { name: 'New Stock Transfer' })).toBeVisible({
      timeout: 20_000,
    })
    await pickComboboxOption(page, 'Search destination branch…')
    await page.getByPlaceholder('e.g. Rebalancing stock for upcoming campaign').fill(reason)
    await expect(async () => {
      await page.getByRole('button', { name: 'Submit Request' }).click()
      await expect(page.getByRole('heading', { name: 'New Stock Transfer' })).toHaveCount(0, {
        timeout: 3_000,
      })
    }).toPass({ timeout: 15_000 })

    const list = ((await (await page.request.get('/api/inventory/transfers?limit=50')).json())
      .data ?? []) as { id: string; reason?: string | null }[]
    const created = list.find((t) => t.reason === reason)
    expect(created, 'the new transfer').toBeTruthy()
    try {
      const detail = await (
        await page.request.get(`/api/inventory/transfers/${created!.id}`)
      ).json()
      expect((detail.lines as { serialNumberId?: string | null }[])[0].serialNumberId).toBe(
        serial!.id
      )
      const accepted = await page.request.patch(`/api/inventory/transfers/${created!.id}/accept`, {
        data: {},
      })
      expect(accepted.ok(), await accepted.text()).toBeTruthy()

      await gotoReady(page, '/inventory/transfers')
      await expect(async () => {
        await page.locator('tbody tr').first().click()
        await expect(page.getByRole('heading', { name: 'Transfer Details' })).toBeVisible({
          timeout: 3_000,
        })
        if (
          !(await page
            .getByText(reason, { exact: true })
            .isVisible()
            .catch(() => false))
        ) {
          await page.getByRole('button', { name: 'Close dialog' }).click()
          throw new Error('opened transfer is not the one just created — retrying')
        }
      }).toPass({ timeout: 20_000 })
      const modal = page.locator('.fixed.inset-0.z-50')
      await clickStable(
        modal.getByRole('button', { name: 'Dispatch' }),
        modal.getByRole('button', { name: 'Confirm Dispatch' }),
        { timeout: 15_000 }
      )
      // The ticked unit is shown, locked — and there is nothing to pick.
      await expect(modal.getByText('all 1 picked by the requester', { exact: false })).toBeVisible()
      await expect(modal.getByPlaceholder('Search serial number…')).toHaveCount(0)
    } finally {
      await cancelStockTransfer(page.request, created!.id)
    }
  })
})
