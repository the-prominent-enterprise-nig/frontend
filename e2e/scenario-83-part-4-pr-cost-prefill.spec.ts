import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { fillStable, gotoReady } from './utils'

// Scenario 83 Part 4 (PR-01) — "Cost shown for items in Purchase Requests must
// reflect the correct item cost." A line added to a Purchase Request (or a PO
// being edited — the form is shared) used to start at Unit price 0. It now
// starts at the chosen supplier's price for the item, else the item's own cost
// price, else blank (Kian, 2026-11-04).
//
// Read-only: each test opens a new Purchase Request, adds one line and reads
// its Unit price. Nothing is saved. Fixtures are looked up through the API, so
// the supplier-price case skips on a database with no priced supplier item
// (the local dev DB has no suppliers at all).

type Paged<T> = T[] | { data?: T[] }
const list = async <T>(request: APIRequestContext, url: string): Promise<T[]> => {
  const res = await request.get(url)
  if (!res.ok()) return []
  const body = (await res.json()) as Paged<T>
  return Array.isArray(body) ? body : (body.data ?? [])
}

type Item = { id: string; name: string; sku: string; costPrice: number | string | null }

/** How the Unit price input shows a peso amount (a plain number, no padding). */
const shown = (n: number) => String(Number(n.toFixed(2)))

async function openNewRequest(page: Page) {
  await gotoReady(page, '/inventory/purchase-orders?tab=requests')
  await page.getByRole('button', { name: 'New Purchase Request' }).click()
  await expect(page.getByPlaceholder('Search item by name or SKU to add a line…')).toBeVisible({
    timeout: 15_000,
  })
}

async function pickFrom(page: Page, placeholder: string, text: string) {
  await fillStable(page.getByPlaceholder(placeholder), text)
  const option = page.locator('div.fixed.z-100 button').filter({ hasText: text }).first()
  await expect(option).toBeVisible({ timeout: 15_000 })
  await option.click()
}

const unitPrice = (page: Page) => page.getByLabel('Unit price').first()

test.describe('Scenario 83 Part 4 — a new line’s Unit price starts at the item’s cost', () => {
  let costed: Item | undefined
  let uncosted: Item | undefined
  let quoted:
    | { supplier: { id: string; name: string }; itemName: string; price: number }
    | undefined

  test.beforeAll(async ({ request }) => {
    const items = await list<Item>(request, '/api/inventory/items?limit=100&lifecycle=active')
    costed = items.find((i) => Number(i.costPrice) > 0)
    uncosted = items.find((i) => i.costPrice == null || Number(i.costPrice) === 0)

    const suppliers = await list<{ id: string; name: string }>(request, '/api/suppliers?limit=50')
    for (const supplier of suppliers) {
      const mapped = await list<{ item: { name: string }; unitPrice: number | string | null }>(
        request,
        `/api/suppliers/${supplier.id}/items`
      )
      const priced = mapped.find((m) => Number(m.unitPrice) > 0)
      if (priced) {
        quoted = { supplier, itemName: priced.item.name, price: Number(priced.unitPrice) }
        break
      }
    }
  })

  test('S83-FE-4.1: with no supplier picked, it starts at the item’s cost price', async ({
    page,
  }) => {
    test.skip(!costed, 'No costed item on this database')
    await openNewRequest(page)
    await pickFrom(page, 'Search item by name or SKU to add a line…', costed!.sku)
    await expect(unitPrice(page)).toHaveValue(shown(Number(costed!.costPrice)))
  })

  test('S83-FE-4.2: an item with no cost price starts blank, as before', async ({ page }) => {
    test.skip(!uncosted, 'No uncosted item on this database')
    await openNewRequest(page)
    await pickFrom(page, 'Search item by name or SKU to add a line…', uncosted!.sku)
    // 0 renders as the empty "0.00" placeholder or a bare 0.
    await expect(unitPrice(page)).toHaveValue(/^0?$/)
  })

  test('S83-FE-4.3: the chosen supplier’s price for the item wins over its cost price', async ({
    page,
  }) => {
    test.skip(!quoted, 'No supplier with a priced item on this database')
    await openNewRequest(page)
    await pickFrom(page, 'Search supplier by name or code…', quoted!.supplier.name)
    await pickFrom(page, 'Search item by name or SKU to add a line…', quoted!.itemName)
    await expect(unitPrice(page)).toHaveValue(shown(quoted!.price))
  })
})
