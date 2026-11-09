import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Ticket #27 — Repair and Return are separate on Create Receiving Report.
 *
 * Return never posts stock: a customer return is received at the POS (which
 * moves the stock, credits the customer and issues its RRC # receiving
 * report), so on the RR screen Return only looks that report up. This covers
 * what the screen does — the posting form and Create button give way to
 * "Find the return", and picking a return shows its receiving report. The
 * lookup's own rules (posted only, branch scope, no stock movement) are
 * covered server-side in the backend's repair-intake-sales.e2e-spec.ts.
 *
 * Seeds its own return through the API: the isolated e2e database ships with
 * no customer returns.
 */

const SI = `E2E-RRRET-${Date.now()}`

async function seedReturn(page: Page): Promise<void> {
  // A return comes back into a branch, so it needs a branch's warehouse.
  const warehouses = await (
    await page.request.get('/api/inventory/warehouses?limit=100&status=active')
  ).json()
  const items = await (await page.request.get('/api/inventory/items?limit=50')).json()
  const warehouseId = (warehouses.data ?? []).find(
    (w: { branchId?: string | null }) => !!w.branchId
  )?.id
  const itemId = (items.data ?? []).find(
    (i: { isSerialTracked?: boolean; isService?: boolean }) => !i.isSerialTracked && !i.isService
  )?.id
  expect(warehouseId, 'a branch warehouse must exist').toBeTruthy()
  expect(itemId, 'a non-serial-tracked item must exist').toBeTruthy()

  const res = await page.request.post('/api/inventory/stock/customer-returns', {
    data: {
      warehouseId,
      salesInvoiceNumber: SI,
      lines: [{ itemId, quantity: 1, unitPrice: 100, disposition: 'quarantine' }],
    },
  })
  expect(res.ok(), `customer return failed: ${await res.text()}`).toBeTruthy()
}

test.describe('Inventory — Create RR, Return reason (ticket #27)', () => {
  test('Return only looks up the POS return: no posting form, and its receiving report shows', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/stock-transaction?tab=receiving')
    await seedReturn(page)

    await gotoReady(page, '/inventory/stock-transaction?tab=receiving&new=1')
    const create = page.getByRole('button', { name: /create receiving report/i })
    await expect(create).toBeVisible({ timeout: 30_000 })

    // Reason is a SearchableSelect: its value sits in a text input, and its
    // options are buttons.
    await page.locator('input[value="Regular Supplier Delivery"]').click()
    await page
      .getByTestId('searchable-select-option')
      .filter({ hasText: /^Return$/ })
      .click()

    await expect(page.getByText('Find the return')).toBeVisible()
    await expect(create).toBeHidden()
    // The bottom bar's Close replaces Create (the header has its own ✕ "Close").
    await expect(page.getByRole('button', { name: 'Close', exact: true }).last()).toBeVisible()
    // The posting panels are gone too.
    await expect(page.getByText(/Items received/)).toBeHidden()

    // Closed, the combobox is a button; opened, it becomes the search input.
    await page.getByRole('button', { name: /Invoice #, customer, serial or RRC #/ }).click()
    await page.getByPlaceholder(/Invoice #, customer, serial or RRC #/).fill(SI)
    await page.getByText(new RegExp(SI)).first().click()

    await expect(page.getByText('Receiving report #')).toBeVisible()
    await expect(page.getByText(/^RRC-/).first()).toBeVisible()
    await expect(page.getByText('Returned at')).toBeVisible()
    await expect(page.getByText('On hold (not sellable)')).toBeVisible()
  })
})
