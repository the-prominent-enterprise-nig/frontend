import { test, expect, type APIRequestContext } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 56 Part 1 — quick frontend cleanups:
//   - Receiving Reports drops its Lines column (table header).
//   - Serials metric band stops calling `pulled_out` "In Transit".
//   - A PO line's description is an internal note: shown on the detail
//     modal and editable on the PO form, but left off the supplier-facing
//     PO document (the same PurchaseOrderSheet the PDF download renders).
// Self-cleaning: cancels the PO it creates.

const NOTE = 'E2E-56 internal pricing note'

async function createPoWithNote(request: APIRequestContext): Promise<{ id: string }> {
  const suppliers = (await (await request.get('/api/suppliers?limit=1')).json()).data as {
    id: string
  }[]
  const items = (
    await (
      await request.get('/api/inventory/items', {
        params: { search: 'Universal Remote Control', limit: '1' },
      })
    ).json()
  ).data as { id: string }[]
  const warehouses = (
    await (
      await request.get('/api/inventory/warehouses', {
        params: { limit: '1', status: 'active', standaloneOnly: 'true' },
      })
    ).json()
  ).data as { id: string }[]

  const res = await request.post('/api/procurement/purchase-orders', {
    data: {
      supplierId: suppliers[0].id,
      warehouseId: warehouses[0].id,
      lines: [{ itemId: items[0].id, quantity: 1, unitPrice: 100, description: NOTE }],
    },
  })
  expect(res.ok()).toBeTruthy()
  return res.json()
}

test.describe('Scenario 56 Part 1 — quick cleanups', () => {
  test('Receiving Reports table has no Lines column', async ({ page }) => {
    await gotoReady(page, '/inventory/stock?tab=reports')
    const table = page.getByRole('table', { name: 'Receiving reports' })
    await expect(table.getByRole('columnheader', { name: 'Units' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(table.getByRole('columnheader', { name: 'Lines' })).toHaveCount(0)
  })

  test('Serials metric band labels pulled-out units as Pulled Out, not In Transit', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/stock?tab=serials')
    await expect(page.getByText('repossessed', { exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('on stock transfer', { exact: true })).toHaveCount(0)
  })

  test('PO line description is internal: on the detail and form, not on the PO document', async ({
    page,
  }) => {
    const po = await createPoWithNote(page.request)
    try {
      await gotoReady(page, `/inventory/purchase-orders?tab=orders&po=${po.id}`)
      const internal = page.getByText(NOTE)
      await expect(internal).toBeVisible({ timeout: 20_000 })
      await expect(page.getByText('Internal:', { exact: true })).toBeVisible()

      // Supplier-facing document: no Description column, no note.
      await page.getByRole('button', { name: 'View PO' }).click()
      await expect(page.getByRole('columnheader', { name: 'Unit price' })).toBeVisible({
        timeout: 20_000,
      })
      await expect(page.getByRole('columnheader', { name: 'Description' })).toHaveCount(0)
      await expect(page.locator('table', { hasText: 'Unit price' })).not.toContainText(NOTE)
      await page.getByRole('button', { name: 'Close' }).last().click()

      // Form: the note loads into the per-line internal note input.
      await gotoReady(page, `/inventory/purchase-orders?tab=orders&po=${po.id}`)
      await page.getByRole('button', { name: 'Edit' }).click()
      await expect(
        page.getByRole('textbox', { name: 'Internal note (not printed)' }).first()
      ).toHaveValue(NOTE, { timeout: 20_000 })
    } finally {
      await page.request.patch(`/api/procurement/purchase-orders/${po.id}/cancel`, {
        data: { reason: 'E2E test cleanup' },
      })
    }
  })
})
