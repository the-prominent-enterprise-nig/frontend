import { test, expect, type Page } from '@playwright/test'
import { fillStable, gotoReady } from './utils'

/**
 * Scenario 69 Part 2 — the RR printable, on the on-screen sheet and the
 * printed paper together (they duplicate the same markup and have drifted
 * before, so both are asserted in one pass):
 *
 *  - labels spelled out: RR No. / RR Date / Reference / PO No. / PO Date
 *  - the supplier's address under its name
 *  - the receiving branch on its own line above the item table, not under
 *    the supplier (where it read as the supplier's branch)
 *
 * Seeds its own standalone receipt through the API. The PO Date fallback to a
 * linked PO's order date is covered by the backend's
 * scenario-69-rr-printable.e2e-spec.ts.
 */

const SUPPLIER_CODE = 'E2E-RR69'
const SUPPLIER_ADDRESS = '12 Rizal St., Iloilo City'

/** Suppliers have no delete route, so this reuses one fixture row across
 * runs rather than leaving one behind per run. */
async function ensureSupplier(page: Page): Promise<string> {
  const existing = await (
    await page.request.get(`/api/suppliers?search=${SUPPLIER_CODE}&limit=1`)
  ).json()
  const found = existing.data?.[0]?.id
  if (found) return found
  const madeRes = await page.request.post('/api/suppliers', {
    data: {
      code: SUPPLIER_CODE,
      name: 'E2E RR Printable Supplier',
      address: SUPPLIER_ADDRESS,
      paymentTerms: 'Net 30',
      currency: 'PHP',
    },
  })
  expect(madeRes.ok(), `supplier create failed: ${await madeRes.text()}`).toBeTruthy()
  const made = await madeRes.json()
  return made.id ?? made.data?.id
}

test.describe('Scenario 69 — RR printable', () => {
  test('spells the labels out, shows the supplier address and the branch above the table', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/stock?tab=reports')

    const warehouses = await (
      await page.request.get('/api/inventory/warehouses?standaloneOnly=true&limit=1&status=active')
    ).json()
    const items = await (await page.request.get('/api/inventory/items?limit=50')).json()
    const warehouseId = warehouses.data?.[0]?.id
    const itemId = (items.data ?? []).find(
      (i: { isSerialTracked?: boolean; isService?: boolean }) => !i.isSerialTracked && !i.isService
    )?.id
    expect(warehouseId, 'a standalone warehouse must exist').toBeTruthy()
    expect(itemId, 'a non-serial-tracked item must exist').toBeTruthy()

    const supplierId = await ensureSupplier(page)
    const poNumber = `E2E-RR69-PO-${Date.now()}`
    const created = await page.request.post('/api/inventory/stock/receive', {
      data: {
        warehouseId,
        supplierId,
        applicationType: 'new_stock',
        deliveryReceiptNumber: `E2E-RR69-DR-${Date.now()}`,
        purchaseOrderNumber: poNumber,
        poDate: '2026-09-01',
        lines: [{ itemId, quantityReceived: 1, unitCost: 100 }],
      },
    })
    expect(created.ok(), `receive failed: ${await created.text()}`).toBeTruthy()
    const receipt = await created.json()
    const receiptCode = receipt.code ?? receipt.data?.code

    await gotoReady(page, '/accounting/receiving-reports')
    const row = page.locator('tbody tr', { hasText: receiptCode })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.click()
    const printButton = page.getByRole('button', { name: 'Print' })
    await expect(printButton).toBeVisible({ timeout: 15_000 })

    // The sheet.
    for (const label of ['RR No.', 'RR Date', 'Reference', 'PO No.', 'PO Date']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible()
    }
    for (const old of ['No.', 'Date', 'Ref', 'P.O. No.', 'Dated']) {
      await expect(page.getByText(old, { exact: true })).toHaveCount(0)
    }
    const supplierAddress = page.getByText(SUPPLIER_ADDRESS, { exact: true })
    await expect(supplierAddress).toBeVisible()
    // The receiving branch: its own line above the table, not under the
    // supplier, where it read as the supplier's branch.
    const branchLine = page.locator('p', { hasText: /^Branch: / })
    await expect(branchLine).toHaveCount(1)
    await expect(supplierAddress.locator('..').getByText(/Branch:/)).toHaveCount(0)

    // The paper.
    const [popup] = await Promise.all([page.waitForEvent('popup'), printButton.click()])
    await popup.waitForLoadState('domcontentloaded')
    for (const label of ['RR No.', 'RR Date', 'Reference', 'PO No.', 'PO Date']) {
      await expect(popup.locator('.meta-label', { hasText: label }).first()).toBeVisible()
    }
    await expect(popup.locator('.meta-label', { hasText: /^Dated$/ })).toHaveCount(0)
    await expect(
      popup.locator('.party .party-address', { hasText: SUPPLIER_ADDRESS })
    ).toBeVisible()
    await expect(popup.locator('.rr-branch')).toHaveCount(1)
    await expect(popup.locator('.rr-branch + table')).toHaveCount(1)
    await expect(popup.locator('.party', { hasText: 'Branch:' })).toHaveCount(0)
    await popup.close()
  })

  test('the printed transfer spells its labels out and names its RR', async ({ page }) => {
    // Any already-received transfer will do: this only reads and prints.
    const listed = await (
      await page.request.get('/api/inventory/transfers?status=received&limit=1')
    ).json()
    const transfer = listed.data?.[0] as { id: string; transferNumber: string } | undefined
    test.skip(!transfer, 'no received transfer in this database')
    const detail = await (await page.request.get(`/api/inventory/transfers/${transfer!.id}`)).json()
    const rrCodes = ((detail.data ?? detail).goodsReceipts ?? []).map(
      (r: { code: string }) => r.code
    ) as string[]

    await gotoReady(page, '/inventory/transfers')
    await fillStable(
      page.getByPlaceholder('Search transfer #, item, SKU, or serial…'),
      transfer!.transferNumber
    )
    const row = page.locator('tbody tr', { hasText: transfer!.transferNumber })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.click()
    await expect(page.getByRole('heading', { name: 'Transfer Details' })).toBeVisible({
      timeout: 15_000,
    })

    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: 'Print', exact: true }).click(),
    ])
    await popup.waitForLoadState('domcontentloaded')
    for (const label of ['Transfer No.', 'Transfer Date', 'RR No.', 'RR Date']) {
      await expect(popup.locator('.meta-label', { hasText: label }).first()).toBeVisible()
    }
    const rrNo = popup.locator('.meta-label', { hasText: 'RR No.' }).locator('+ .meta-value')
    for (const code of rrCodes) await expect(rrNo).toContainText(code)
    if (rrCodes.length) {
      const rrDate = popup.locator('.meta-label', { hasText: 'RR Date' }).locator('+ .meta-value')
      await expect(rrDate).not.toHaveText('—')
    }
    await popup.close()
  })
})
