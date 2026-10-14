import { test, expect } from '@playwright/test'
import { gotoReady, fillStable, clickStable } from './utils'

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
      // booking is decided.
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
