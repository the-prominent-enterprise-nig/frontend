import { test, expect, type Locator, type Page } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Approve — clicking the list button must NOT commit instantly anymore; it
// must open a confirmation modal first. Go Back must not commit; confirming
// inside the modal must.
async function runApproveConfirmFlow(page: Page, row: Locator) {
  await row.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByRole('heading', { name: 'Approve Purchase Order' })).toBeVisible({
    timeout: 10_000,
  })

  await page.getByRole('button', { name: 'Go Back' }).click()
  await expect(page.getByRole('heading', { name: 'Approve Purchase Order' })).toHaveCount(0, {
    timeout: 10_000,
  })
  await expect(row).toContainText('Pending')

  await row.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByRole('heading', { name: 'Approve Purchase Order' })).toBeVisible({
    timeout: 10_000,
  })
  // Scope to the modal's own footer button — the list's "Approve" trigger
  // button is still present in the DOM behind the overlay.
  await page.locator('.fixed.inset-0').getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Approve Purchase Order' })).toHaveCount(0, {
    timeout: 10_000,
  })
  await expect(row).toContainText('Approved', { timeout: 10_000 })
}

// Scenario 29 item 3 (PO-15 + PO-11):
// - PO-15: PO Approve/Send/Close and PR Submit used to commit instantly with
//   no confirmation, unlike Cancel/Reject/Convert which already confirm via
//   modal. This covers Approve specifically (Send/Close/Submit share the
//   same ConfirmActionModal component, same wiring pattern, lower risk).
// - PO-11 (revised, developer-requested 2026-08-17): shipping address is
//   NOT a free-text field — a PO's destination is always one of the 2 real
//   standalone warehouses (Scenario 27), so shippingAddress is derived
//   server-side from that warehouse's own registered `address`, never
//   editable. This confirms the derivation, not a form field (there isn't
//   one anymore).
//
// Fixture setup goes through POST /procurement/purchase-orders directly
// (not the "New Purchase" UI modal) — that modal always drafts a Purchase
// Request regardless of which tab it's opened from (CreatePoModal's own
// comment confirms this), so it's the wrong tool for getting a PO onto the
// Purchase Orders list quickly; the backend's direct-create endpoint exists
// specifically for this ("Create a purchase order directly (no PR
// required)"). What's under test here — the Approve confirmation and the
// derived shipping address — lives entirely in PurchaseOrderList.tsx and
// PoDetailModal.tsx, neither of which cares how the PO was created.
//
// Self-cleaning: cancels the PO it creates and restores the warehouse's
// original address (the seeded standalone warehouses have none set, so this
// test sets one temporarily to have a real value to assert against — no
// hard delete exists via the UI for the PO itself).

test.describe('Inventory — Purchase Order confirm-before-commit + shipping address', () => {
  test('Approve requires confirmation (Go Back does not commit) and shipping address derives from the warehouse', async ({
    page,
  }) => {
    const testAddress = `E2E Warehouse Address ${Date.now()}, Bago, Negros Occidental`

    const suppliersRes = await page.request.get('/api/suppliers?limit=1')
    const suppliers = ((await suppliersRes.json()).data ?? []) as { id: string }[]
    const supplierId = suppliers[0].id

    const warehousesRes = await page.request.get('/api/inventory/warehouses', {
      params: { limit: '1', status: 'active', standaloneOnly: 'true' },
    })
    const warehouses = ((await warehousesRes.json()).data ?? []) as {
      id: string
      address: string | null
    }[]
    const warehouse = warehouses[0]
    const originalAddress = warehouse.address

    // Give the warehouse a real address to assert against — the seeded
    // standalone warehouses (WH-NEGROS/WH-PANAY) have none set by default.
    const patchRes = await page.request.patch(`/api/inventory/warehouses/${warehouse.id}`, {
      data: { address: testAddress },
    })
    expect(patchRes.ok()).toBeTruthy()

    try {
      const itemsRes = await page.request.get('/api/inventory/items', {
        params: { search: 'Universal Remote Control', limit: '1' },
      })
      const items = ((await itemsRes.json()).data ?? []) as { id: string; sellingPrice: number }[]
      const item = items[0]

      const poRes = await page.request.post('/api/procurement/purchase-orders', {
        data: {
          supplierId,
          warehouseId: warehouse.id,
          lines: [{ itemId: item.id, quantity: 5, unitPrice: 500 }],
        },
      })
      expect(poRes.ok()).toBeTruthy()
      const po = await poRes.json()
      // Derived server-side at creation — never sent by the client.
      expect(po.shippingAddress).toBe(testAddress)

      await gotoReady(page, '/inventory/purchase-orders')
      const row = page.locator('tbody tr', { hasText: po.code })
      await expect(row).toBeVisible({ timeout: 15_000 })

      // Detail view shows the warehouse's address, with no way to edit it —
      // no shipping-address field exists anywhere in the create/convert forms.
      await row.locator('td').first().click()
      await expect(page.getByText('Shipping Address', { exact: true })).toBeVisible({
        timeout: 10_000,
      })
      await expect(page.getByText(testAddress, { exact: false }).first()).toBeVisible()
      await page.locator('div.fixed button:has(svg.lucide-x)').first().click()

      await runApproveConfirmFlow(page, row)

      // Cleanup — cancel the now-approved PO (no hard delete via the UI).
      await row.locator('button:has(svg.lucide-ban)').click()
      await expect(page.getByRole('heading', { name: 'Cancel Purchase Order' })).toBeVisible({
        timeout: 10_000,
      })
      await fillStable(
        page.getByPlaceholder('Provide a reason for cancelling this purchase order…'),
        'E2E test cleanup'
      )
      await page.getByRole('button', { name: 'Cancel Order' }).click()
      await expect(page.getByRole('heading', { name: 'Cancel Purchase Order' })).toHaveCount(0, {
        timeout: 10_000,
      })
      await expect(row).toContainText('Cancelled', { timeout: 10_000 })
    } finally {
      await page.request.patch(`/api/inventory/warehouses/${warehouse.id}`, {
        data: { address: originalAddress },
      })
    }
  })

  test('PR Submit requires confirmation (Go Back does not commit)', async ({ page }) => {
    const suppliersRes = await page.request.get('/api/suppliers?limit=1')
    const suppliers = ((await suppliersRes.json()).data ?? []) as { id: string }[]

    const itemsRes = await page.request.get('/api/inventory/items', {
      params: { search: 'Universal Remote Control', limit: '1' },
    })
    const items = ((await itemsRes.json()).data ?? []) as { id: string }[]
    const item = items[0]

    const prRes = await page.request.post('/api/procurement/purchase-requests', {
      data: {
        supplierId: suppliers[0].id,
        lines: [{ itemId: item.id, quantity: 3, unitPrice: 100 }],
      },
    })
    expect(prRes.ok()).toBeTruthy()
    const pr = await prRes.json()

    await gotoReady(page, '/inventory/purchase-requests')
    const row = page.locator('tbody tr', { hasText: pr.code })
    await expect(row).toBeVisible({ timeout: 15_000 })

    await row.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByRole('heading', { name: 'Submit Purchase Request' })).toBeVisible({
      timeout: 10_000,
    })

    await page.getByRole('button', { name: 'Go Back' }).click()
    await expect(page.getByRole('heading', { name: 'Submit Purchase Request' })).toHaveCount(0, {
      timeout: 10_000,
    })
    await expect(row).toContainText('draft', { ignoreCase: true })

    await row.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByRole('heading', { name: 'Submit Purchase Request' })).toBeVisible({
      timeout: 10_000,
    })
    await page
      .locator('.fixed.inset-0')
      .getByRole('button', { name: 'Submit', exact: true })
      .click()
    await expect(page.getByRole('heading', { name: 'Submit Purchase Request' })).toHaveCount(0, {
      timeout: 10_000,
    })
    await expect(row).toContainText('submitted', { ignoreCase: true, timeout: 10_000 })

    // Cleanup — cancel (no hard delete via the UI).
    await row.getByRole('button', { name: 'Cancel', exact: true }).click()
  })
})
