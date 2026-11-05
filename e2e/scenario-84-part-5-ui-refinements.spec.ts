import { test, expect, type APIRequestContext, type Page, type Route } from '@playwright/test'
import { clickStable, fillStable, gotoReady } from './utils'

// Scenario 84 Part 5 — UI refinements found reviewing Parts 1–4 on the live
// screens (Kian, 2026-11-04):
//   - the POS Overview's month is stepped with ‹ ›, never typed; its date
//     range's two ends are picked from a calendar, From never after To
//   - a Purchase Request line's Unit price reads "29,520.00", like Line total
//   - a supplier picked AFTER the lines re-prices the untouched ones
//   - a negative Tot. Amt. Due (an advance) is red, like the Due column
//
// Read-only: nothing is saved. Fixtures are looked up through the API and a
// case skips on a database without one.

type Paged<T> = T[] | { data?: T[] }
const list = async <T>(request: APIRequestContext, url: string): Promise<T[]> => {
  const res = await request.get(url)
  if (!res.ok()) return []
  const body = (await res.json()) as Paged<T>
  return Array.isArray(body) ? body : (body.data ?? [])
}

const monthLabel = (d: Date) => d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
const shown = (n: number) =>
  n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

test.describe('Scenario 84 Part 5 — POS Overview month and dates are picked, not typed', () => {
  test('S84-FE-5.1: ‹ › step the month, and the next month past this one is off', async ({
    page,
  }) => {
    await gotoReady(page, '/pos')
    const month = page.getByTestId('overview-month')
    const now = new Date()
    await expect(month).toHaveText(monthLabel(now))
    // No future month, and no typeable month box.
    await expect(page.getByRole('button', { name: 'Next month' })).toBeDisabled()
    await expect(page.locator('input[type="month"]')).toHaveCount(0)

    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    // Not clickStable: a retried click would step back a second month. Only
    // click while the month hasn't moved yet (the first can land pre-hydration).
    await expect(async () => {
      if ((await month.textContent()) === monthLabel(now)) {
        await page.getByRole('button', { name: 'Previous month' }).click()
      }
      await expect(month).toHaveText(monthLabel(last), { timeout: 1_000 })
    }).toPass({ timeout: 10_000 })
    await expect(page.getByTestId('overview-period-label')).toHaveText(
      `Showing ${monthLabel(last)}`
    )
    await page.getByRole('button', { name: 'Next month' }).click()
    await expect(month).toHaveText(monthLabel(now))
  })

  test('S84-FE-5.2: the date range is picked from a calendar, with no day after today offered', async ({
    page,
  }) => {
    await gotoReady(page, '/pos')
    const period = page.getByTestId('overview-period')
    const from = page.getByRole('button', { name: 'From', exact: true })
    await clickStable(period.getByRole('button', { name: 'Date range' }), from)
    // No browser date boxes to type into.
    await expect(period.locator('input[type="date"]')).toHaveCount(0)

    await from.click()
    const calendar = page.getByRole('dialog', { name: 'Pick the from date' })
    await expect(calendar).toBeVisible()
    const now = new Date()
    const long = (d: Date) =>
      d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
    // Tomorrow (if still this month) shows, faint, but isn't a button.
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    await expect(calendar.getByRole('button', { name: long(tomorrow), exact: true })).toHaveCount(0)
    await expect(calendar.getByRole('button', { name: 'Next month' })).toBeHidden()

    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    await calendar.getByRole('button', { name: long(first), exact: true }).click()
    await expect(calendar).toHaveCount(0)
    const short = (d: Date) =>
      d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    await expect(from).toHaveText(short(first))
    if (now.getDate() > 1) {
      await expect(page.getByTestId('overview-period-label')).toHaveText(
        `Showing ${short(first)} – ${short(now)}`
      )
    }
  })
})

test.describe('Scenario 84 Part 5 — Purchase Request Unit price', () => {
  type Item = { id: string; name: string; sku: string; costPrice: number | string | null }
  let costly: Item | undefined
  let quoted: { supplier: { id: string; name: string }; item: Item; price: number } | undefined

  test.beforeAll(async ({ request }) => {
    const items = await list<Item>(request, '/api/inventory/items?limit=100&lifecycle=active')
    costly = items.find((i) => Number(i.costPrice) >= 1000)

    const suppliers = await list<{ id: string; name: string }>(request, '/api/suppliers?limit=50')
    for (const supplier of suppliers) {
      const mapped = await list<{
        itemId: string
        item: { name: string; sku?: string }
        unitPrice: number | string | null
      }>(request, `/api/suppliers/${supplier.id}/items`)
      for (const m of mapped.filter((x) => Number(x.unitPrice) > 0)) {
        const res = await request.get(`/api/inventory/items/${m.itemId}`)
        if (!res.ok()) continue
        const body = await res.json()
        const item = (body.data ?? body) as Item
        // Only a price that differs from the item's cost shows a re-price.
        if (Math.abs(Number(item.costPrice ?? 0) - Number(m.unitPrice)) > 0.005) {
          quoted = { supplier, item, price: Number(m.unitPrice) }
          break
        }
      }
      if (quoted) break
    }
  })

  async function openNewRequest(page: Page) {
    await gotoReady(page, '/inventory/purchase-orders?tab=requests')
    await page.getByRole('button', { name: 'New Purchase Request' }).click()
    await expect(
      page.getByRole('button', { name: 'Search item by name or SKU to add a line…' })
    ).toBeVisible({ timeout: 30_000 })
  }

  async function pickFrom(page: Page, placeholder: string, text: string) {
    await page.getByRole('button', { name: placeholder }).click()
    await fillStable(page.getByPlaceholder(placeholder), text)
    const option = page.locator('div.fixed.z-100 button').filter({ hasText: text }).first()
    await expect(option).toBeVisible({ timeout: 15_000 })
    await option.click()
  }

  const unitPrice = (page: Page) => page.getByLabel('Unit price').first()

  test('S84-FE-5.3: the Unit price reads grouped, like Line total, and bare while typed into', async ({
    page,
  }) => {
    test.skip(!costly, 'No item costing ₱1,000 or more on this database')
    await openNewRequest(page)
    await pickFrom(page, 'Search item by name or SKU to add a line…', costly!.sku)
    const cost = Number(costly!.costPrice)
    await expect(unitPrice(page)).toHaveValue(shown(cost))
    await unitPrice(page).focus()
    await expect(unitPrice(page)).toHaveValue(String(Number(cost.toFixed(2))))
  })

  test('S84-FE-5.4: a supplier picked after the line re-prices it to that supplier’s price', async ({
    page,
  }) => {
    test.skip(!quoted, 'No supplier price that differs from the item’s cost on this database')
    await openNewRequest(page)
    await pickFrom(page, 'Search item by name or SKU to add a line…', quoted!.item.sku)
    await expect(unitPrice(page)).toHaveValue(
      Number(quoted!.item.costPrice) > 0 ? shown(Number(quoted!.item.costPrice)) : /^0?$/
    )
    await pickFrom(page, 'Search supplier by name or code…', quoted!.supplier.name)
    await expect(unitPrice(page)).toHaveValue(shown(quoted!.price))
  })
})

test.describe('Scenario 84 Part 5 — a negative Tot. Amt. Due is red', () => {
  test('S84-FE-5.5: the plan ledger shows an advance in Tot. Amt. Due in red', async ({
    page,
    request,
  }) => {
    const rows = await list<{ id: string; customerId: string; itemNames?: string[] }>(
      request,
      '/api/crm/installment-accounts?limit=20&status=active'
    )
    const plan = rows.find((r) => (r.itemNames ?? []).length > 0)
    test.skip(!plan, 'No active POS installment plan on this database')

    // Same read-only trick as Part 3: the real ledger, ending on a ₱620 advance.
    await page.route(
      /\/api\/crm\/installment-accounts\/[^/]+\/ledger(\?|$)/,
      async (route: Route) => {
        const response = await route.fetch()
        const body = await response.json()
        const ledger = Array.isArray(body?.rows) ? body : body?.data
        if (ledger?.rows?.length) {
          ledger.rows[ledger.rows.length - 1].due = -620
          if (ledger.account) ledger.account.totalDue = -620
        }
        await route.fulfill({ response, json: body })
      }
    )
    await gotoReady(page, `/crm/customers/${plan!.customerId}/installments/${plan!.id}`)
    const value = page
      .getByText('Tot. Amt. Due', { exact: true })
      .locator('xpath=following-sibling::p')
    await expect(value).toHaveText('-₱620.00', { timeout: 15_000 })
    await expect(value).toHaveClass(/text-red-600/)
  })
})
