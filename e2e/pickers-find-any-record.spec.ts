import { test, expect, type Page } from '@playwright/test'
import { gotoReady, clickStable, deleteCustomers, pickFromSearchCombobox } from './utils'

// Docket #94 audit, Group 2 — customer and item pickers.
//
// These screens loaded "the items" / "the customers" into a dropdown with a
// hard cap (200 or 500) and offered only that. The catalog has 3,500+ items
// and the customer list hundreds of thousands of rows, so anything past the
// cap could not be picked at all. Now each picker asks the server as you type.
//
// Every test picks the record the old cap could NOT reach: the OLDEST item
// (the list is newest-first, 200 deep) and a customer whose name sorts after
// 500 others.

const STAMP = Date.now()
const BUYER = `ZZZ E2E Picker Buyer ${STAMP}`
const createdCustomerIds: string[] = []

type Item = { id: string; name: string; sku: string; brand?: { id: string; name: string } | null }
let oldest: Item
let buyerId: string

const pick = pickFromSearchCombobox

/** Click a page button until the picker it opens is on screen (the click can
 * land before the page is hydrated). */
async function openUntilPicker(page: Page, buttonName: string | RegExp, placeholder: string) {
  await clickStable(
    page.getByRole('button', { name: buttonName }),
    page.getByRole('button', { name: placeholder, exact: true })
  )
}

async function createCustomer(page: Page, name: string, phoneSeed: number): Promise<string> {
  const res = await page.request.post('/api/crm/customers', {
    data: {
      name,
      customerType: 'individual',
      phone: `0918${String(phoneSeed).padStart(7, '0')}`,
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const { id } = (await res.json()) as { id: string }
  createdCustomerIds.push(id)
  return id
}

test.describe.configure({ mode: 'serial' })

test.describe('Pickers — reach records beyond the old cap', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(420_000)
    const context = await browser.newContext({ storageState: 'e2e/.auth/business-owner.json' })
    const page = await context.newPage()
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

    // The oldest active item — the newest-first list never reaches it.
    const res = await page.request.get('/api/inventory/items', {
      params: { sortBy: 'createdAt', sortOrder: 'asc', limit: '1', lifecycle: 'active' },
    })
    const body = (await res.json()) as { data: Item[]; meta?: { total?: number }; total?: number }
    expect(body.data.length).toBeGreaterThan(0)
    expect(body.meta?.total ?? body.total ?? 0, 'more than the old 200-item cap').toBeGreaterThan(
      200
    )
    oldest = body.data[0]

    // 520 customers whose names sort before the buyer: past the old 500 cap.
    const existing = (await (await page.request.get('/api/crm/customers?limit=1')).json()) as {
      meta: { total: number }
    }
    const fillersNeeded = Math.max(0, 520 - existing.meta.total)
    for (let i = 0; i < fillersNeeded; i += 20) {
      await Promise.all(
        Array.from({ length: Math.min(20, fillersNeeded - i) }, (_, k) =>
          createCustomer(
            page,
            `AAA E2E Picker Filler ${STAMP} ${String(i + k).padStart(3, '0')}`,
            i + k + 1
          )
        )
      )
    }
    buyerId = await createCustomer(page, BUYER, 9_100_001)
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/business-owner.json' })
    const page = await context.newPage()
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await deleteCustomers(page.request, createdCustomerIds)
    await context.close()
  })

  // ── Customers ────────────────────────────────────────────────────────────
  test('Customer Statement: a customer outside the first 500 can be picked, and a deep link names its customer', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/reports?tab=customer-statement')
    await pick(page, 'Search customer by name, phone or email…', BUYER, BUYER, BUYER)
    await expect(page.getByRole('button', { name: 'Run Report' })).toBeEnabled()

    // Arriving by link (e.g. from a customer profile) names the customer too —
    // by id, not by finding them in a loaded page.
    await gotoReady(page, `/accounting/reports?tab=customer-statement&customerId=${buyerId}`)
    await expect(page.getByRole('button', { name: BUYER })).toBeVisible({
      timeout: 20_000,
    })
  })

  test('New Special Account: a customer outside the first 200 can be linked', async ({ page }) => {
    await gotoReady(page, '/accounting/special-accounts')
    await clickStable(
      page.getByRole('button', { name: /New Special Account/ }),
      page.getByRole('button', { name: 'customer', exact: true })
    )
    await page.getByRole('button', { name: 'customer', exact: true }).click()
    await pick(page, 'Search customer…', BUYER, BUYER, BUYER)
  })

  // ── Items ────────────────────────────────────────────────────────────────
  test('Reservations: the oldest item can be reserved', async ({ page }) => {
    await gotoReady(page, '/inventory/reservations')
    await openUntilPicker(page, 'New Reservation', 'Search item by name or SKU…')
    await pick(page, 'Search item by name or SKU…', oldest.sku, oldest.sku, oldest.name)
  })

  test('Backorders: the oldest item can be put on backorder', async ({ page }) => {
    await gotoReady(page, '/inventory/backorders')
    await openUntilPicker(page, 'New Backorder', 'Search item by name or SKU…')
    await pick(page, 'Search item by name or SKU…', oldest.sku, oldest.sku, oldest.name)
  })

  test('Batches: the oldest item can start a batch and can filter the list', async ({ page }) => {
    await gotoReady(page, '/inventory/batches')
    await pick(page, 'All items — search to filter', oldest.sku, oldest.sku, oldest.name)
    await openUntilPicker(page, 'New Batch', 'Search item by name or SKU…')
    await pick(page, 'Search item by name or SKU…', oldest.sku, oldest.sku, oldest.name)
  })

  test('Quality Hold: the oldest item can be held and can filter the list', async ({ page }) => {
    await gotoReady(page, '/inventory/quality-hold')
    await pick(page, 'All items — search to filter', oldest.sku, oldest.sku, oldest.name)
    await openUntilPicker(page, 'Place on Hold', 'Search item by name or SKU…')
    await pick(page, 'Search item by name or SKU…', oldest.sku, oldest.sku, oldest.name)
  })

  test('Revaluation: the oldest item can be revalued', async ({ page }) => {
    await gotoReady(page, '/inventory/revaluation')
    await openUntilPicker(page, 'New Revaluation', 'Search an item by name or SKU…')
    await pick(page, 'Search an item by name or SKU…', oldest.sku, oldest.sku, oldest.name)
  })

  test('Costing: the oldest item can be issued', async ({ page }) => {
    await gotoReady(page, '/inventory/costing')
    await openUntilPicker(page, 'Issue Stock', 'Search an item by name or SKU…')
    await pick(page, 'Search an item by name or SKU…', oldest.sku, oldest.sku, oldest.name)
  })

  test('Serial numbers: the oldest item can be registered against, and the Brand filter lists every brand', async ({
    page,
  }) => {
    // A brand none of the 200 newest items carry — the old Brand filter was
    // built from those items, so it never listed this one.
    const newest = (await (
      await page.request.get('/api/inventory/items', { params: { limit: '200' } })
    ).json()) as { data: Item[] }
    const seen = new Set(newest.data.map((i) => i.brand?.id).filter(Boolean))
    const brands = (await (
      await page.request.get('/api/inventory/classification/brands')
    ).json()) as { id: string; name: string }[]
    const missing = brands.find((b) => !seen.has(b.id))
    expect(missing, 'a brand outside the 200 newest items').toBeTruthy()

    await gotoReady(page, '/inventory/serial-numbers')
    await openUntilPicker(page, 'Register serials', 'Search item by SKU or name…')
    await pick(page, 'Search item by SKU or name…', oldest.sku, oldest.sku, oldest.name)
    await page.getByRole('button', { name: 'Cancel' }).click()

    const brandFilter = page.getByPlaceholder('All brands')
    await brandFilter.click()
    await brandFilter.fill(missing!.name)
    await expect(
      page.getByTestId('searchable-select-option').filter({ hasText: missing!.name }).first()
    ).toBeVisible({ timeout: 15_000 })
  })
})
