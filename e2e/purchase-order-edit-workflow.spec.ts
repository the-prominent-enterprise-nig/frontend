import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Scenario 29 item 4 (PO-06/PO-08/PO-16) — UI side. Backend correctness
// (line replacement, discount breakdown, approval-voiding, status
// eligibility) is covered by backend/test/purchase-order-edit-workflow.e2e-spec.ts;
// this sticks to the new Edit entry point and the approved-PO warning.
// Self-cleaning: cancels the PO it creates (no hard delete via the UI).

test.describe('Inventory — Purchase Order edit workflow', () => {
  test('Edit button opens a pre-filled form for a draft PO and saves changes', async ({ page }) => {
    const suppliersRes = await page.request.get('/api/suppliers?limit=1')
    const suppliers = ((await suppliersRes.json()).data ?? []) as { id: string; name: string }[]
    const supplier = suppliers[0]

    const itemsRes = await page.request.get('/api/inventory/items', {
      params: { search: 'Universal Remote Control', limit: '1' },
    })
    const items = ((await itemsRes.json()).data ?? []) as { id: string }[]
    const item = items[0]

    const warehousesRes = await page.request.get('/api/inventory/warehouses', {
      params: { limit: '1', status: 'active', standaloneOnly: 'true' },
    })
    const warehouseId = ((await warehousesRes.json()).data ?? [])[0].id as string

    const poRes = await page.request.post('/api/procurement/purchase-orders', {
      data: {
        supplierId: supplier.id,
        warehouseId,
        lines: [{ itemId: item.id, quantity: 2, unitPrice: 100 }],
      },
    })
    expect(poRes.ok()).toBeTruthy()
    const po = await poRes.json()

    await gotoReady(page, '/inventory/purchase-orders')
    const row = page.locator('tbody tr', { hasText: po.code })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await expect(row).toContainText('₱200.00')

    await row.locator('button:has(svg.lucide-pencil)').click()
    await expect(page.getByRole('heading', { name: 'Edit Purchase Order' })).toBeVisible({
      timeout: 10_000,
    })
    // No "reverts to draft" warning for an already-draft PO.
    await expect(page.getByText('reverts it to Draft', { exact: false })).toHaveCount(0)

    const numberInputs = page.locator('input[type="number"]')
    await fillStable(numberInputs.nth(0), '5') // Quantity

    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Purchase Order' })).toHaveCount(0, {
      timeout: 10_000,
    })
    await expect(row).toContainText('₱500.00', { timeout: 10_000 })
    await expect(row).toContainText('Pending') // still draft

    // Cleanup.
    await row.locator('button:has(svg.lucide-ban)').click()
    await fillStable(
      page.getByPlaceholder('Provide a reason for cancelling this purchase order…'),
      'E2E test cleanup'
    )
    await page.getByRole('button', { name: 'Cancel Order' }).click()
    await expect(row).toContainText('Cancelled', { timeout: 10_000 })
  })

  test('editing an approved PO warns it will revert to draft, and it does after saving', async ({
    page,
  }) => {
    const suppliersRes = await page.request.get('/api/suppliers?limit=1')
    const suppliers = ((await suppliersRes.json()).data ?? []) as { id: string }[]

    const itemsRes = await page.request.get('/api/inventory/items', {
      params: { search: 'Universal Remote Control', limit: '1' },
    })
    const items = ((await itemsRes.json()).data ?? []) as { id: string }[]
    const item = items[0]

    const warehousesRes = await page.request.get('/api/inventory/warehouses', {
      params: { limit: '1', status: 'active', standaloneOnly: 'true' },
    })
    const warehouseId = ((await warehousesRes.json()).data ?? [])[0].id as string

    const poRes = await page.request.post('/api/procurement/purchase-orders', {
      data: {
        supplierId: suppliers[0].id,
        warehouseId,
        lines: [{ itemId: item.id, quantity: 1, unitPrice: 100 }],
      },
    })
    const po = await poRes.json()
    const approveRes = await page.request.patch(`/api/procurement/purchase-orders/${po.id}/approve`)
    expect(approveRes.ok()).toBeTruthy()

    await gotoReady(page, '/inventory/purchase-orders')
    const row = page.locator('tbody tr', { hasText: po.code })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await expect(row).toContainText('Approved')

    await row.locator('button:has(svg.lucide-pencil)').click()
    await expect(page.getByRole('heading', { name: 'Edit Purchase Order' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('reverts it to Draft', { exact: false })).toBeVisible()

    const numberInputs = page.locator('input[type="number"]')
    await fillStable(numberInputs.nth(0), '3') // Quantity

    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Purchase Order' })).toHaveCount(0, {
      timeout: 10_000,
    })
    await expect(row).toContainText('Pending', { timeout: 10_000 }) // reverted to draft
    await expect(row).toContainText('₱300.00')

    // Cleanup.
    await row.locator('button:has(svg.lucide-ban)').click()
    await fillStable(
      page.getByPlaceholder('Provide a reason for cancelling this purchase order…'),
      'E2E test cleanup'
    )
    await page.getByRole('button', { name: 'Cancel Order' }).click()
    await expect(row).toContainText('Cancelled', { timeout: 10_000 })
  })

  test('a sent PO has no Edit button — only Close is available, and it works', async ({ page }) => {
    const suppliersRes = await page.request.get('/api/suppliers?limit=1')
    const suppliers = ((await suppliersRes.json()).data ?? []) as { id: string }[]

    const itemsRes = await page.request.get('/api/inventory/items', {
      params: { search: 'Universal Remote Control', limit: '1' },
    })
    const items = ((await itemsRes.json()).data ?? []) as { id: string }[]
    const item = items[0]

    const warehousesRes = await page.request.get('/api/inventory/warehouses', {
      params: { limit: '1', status: 'active', standaloneOnly: 'true' },
    })
    const warehouseId = ((await warehousesRes.json()).data ?? [])[0].id as string

    const poRes = await page.request.post('/api/procurement/purchase-orders', {
      data: {
        supplierId: suppliers[0].id,
        warehouseId,
        lines: [{ itemId: item.id, quantity: 1, unitPrice: 100 }],
      },
    })
    const po = await poRes.json()
    const approveRes = await page.request.patch(`/api/procurement/purchase-orders/${po.id}/approve`)
    expect(approveRes.ok()).toBeTruthy()
    const sendRes = await page.request.patch(`/api/procurement/purchase-orders/${po.id}/send`)
    expect(sendRes.ok()).toBeTruthy()

    await gotoReady(page, '/inventory/purchase-orders')
    const row = page.locator('tbody tr', { hasText: po.code })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await expect(row).toContainText('Sent')

    await expect(row.locator('button:has(svg.lucide-pencil)')).toHaveCount(0)
    const closeButton = row.locator('button:has(svg.lucide-archive)')
    await expect(closeButton).toBeVisible()
    await closeButton.click()

    await expect(page.getByRole('heading', { name: 'Close Purchase Order' })).toBeVisible({
      timeout: 10_000,
    })
    // Unscoped, this also matches the labeled "Close" button a pre-seeded
    // fully_received PO's own row already shows elsewhere in the same
    // table — scope to the confirmation modal itself.
    await page.locator('.fixed.inset-0').getByRole('button', { name: 'Close', exact: true }).click()
    await expect(row).toContainText('Closed', { timeout: 10_000 })
  })
})
