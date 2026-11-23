import { test, expect, type Page } from '@playwright/test'
import { gotoReady, createSellableItem, deleteItem, deleteCustomers } from './utils'

// Docket #94 audit — the dashboard learned each sale's customer and the
// month's new-customer count from the FIRST 200 customers of the list (which
// is ordered by NAME and has hundreds of thousands of rows). So:
//   - Top Customers / Recent Transactions named anyone outside that page
//     "Walk-in Customer" / "Customer";
//   - Module Stats "New This Month" counted only the new customers among
//     those 200 alphabetically-first ones, and stopped at 200.
// Now the transactions list carries the customer's name, and the count is the
// server's (`createdFrom` + meta.total).
//
// The fixture makes the failing condition: at least 200 customers whose names
// sort BEFORE the buyer's, so the buyer is outside the first page.

const STAMP = Date.now()
const BUYER = `ZZZ E2E Dashboard Buyer ${STAMP}`
const createdCustomerIds: string[] = []
let itemId: string | undefined

/** First instant of this month in Manila (UTC+8), as the backend's `createdFrom`. */
function manilaMonthStartIso(): string {
  const manilaNow = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const start =
    Date.UTC(manilaNow.getUTCFullYear(), manilaNow.getUTCMonth(), 1) - 8 * 60 * 60 * 1000
  return new Date(start).toISOString()
}

async function createCustomer(page: Page, name: string, phoneSeed: number): Promise<string> {
  const res = await page.request.post('/api/crm/customers', {
    data: {
      name,
      customerType: 'individual',
      phone: `0917${String(phoneSeed).padStart(7, '0')}`,
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const { id } = (await res.json()) as { id: string }
  createdCustomerIds.push(id)
  return id
}

test.describe.configure({ mode: 'serial' })

test.describe('Dashboard — customer names and counts beyond the first 200 customers', () => {
  let buyerSaleNumber = ''

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000)
    const context = await browser.newContext({ storageState: 'e2e/.auth/business-owner.json' })
    const page = await context.newPage()
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

    // 200 customers whose names sort before the buyer (alphabetical page 1).
    const existing = (await (await page.request.get('/api/crm/customers?limit=1')).json()) as {
      meta: { total: number }
    }
    const fillersNeeded = Math.max(0, 200 - existing.meta.total)
    for (let i = 0; i < fillersNeeded; i += 10) {
      await Promise.all(
        Array.from({ length: Math.min(10, fillersNeeded - i) }, (_, k) =>
          createCustomer(
            page,
            `AAA E2E Filler ${STAMP} ${String(i + k).padStart(3, '0')}`,
            i + k + 1
          )
        )
      )
    }
    const buyerId = await createCustomer(page, BUYER, 9_000_001)

    // A sale to the buyer, at the branch of whatever session is open.
    const sessions = (await (
      await page.request.get('/api/pos/sessions', { params: { status: 'open' } })
    ).json()) as { id: string; terminal?: { branch?: { name: string } } }[]
    expect(sessions.length, 'an open POS session is needed').toBeGreaterThan(0)
    const session = sessions[0]
    const branchName = session.terminal?.branch?.name ?? 'San Sebastian'
    const item = await createSellableItem(page.request, {
      prefix: 'E2E Dashboard',
      branchName,
      sellingPrice: 777,
    })
    itemId = item.id
    const saleRes = await page.request.post('/api/pos/transactions', {
      data: {
        sessionId: session.id,
        customerId: buyerId,
        salesInvoiceNumber: `SI-E2E-DASH-${STAMP}`,
        subtotal: item.sellingPrice,
        totalAmount: item.sellingPrice,
        currency: 'PHP',
        lines: [
          { itemId: item.id, itemName: item.name, quantity: 1, unitPrice: item.sellingPrice },
        ],
      },
    })
    expect(saleRes.ok(), await saleRes.text()).toBeTruthy()
    buyerSaleNumber = ((await saleRes.json()) as { transactionNumber: string }).transactionNumber
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/business-owner.json' })
    const page = await context.newPage()
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await deleteCustomers(page.request, createdCustomerIds)
    if (itemId) await deleteItem(page.request, itemId)
    await context.close()
  })

  test('the transactions list names the sale’s customer, wherever they sort in the customer list', async ({
    page,
  }) => {
    await gotoReady(page, '/dashboard')
    const res = await page.request.get('/api/pos/transactions')
    const txns = (await res.json()) as { transactionNumber: string; customerName: string | null }[]
    expect(txns.find((t) => t.transactionNumber === buyerSaleNumber)?.customerName).toBe(BUYER)
  })

  test('Top Customers and Recent Transactions name the buyer, who is outside the first 200 customers', async ({
    page,
  }) => {
    // Show the two widgets on the admin dashboard (the layout is per-browser).
    await page.addInitScript(() => {
      localStorage.setItem(
        'prominent-dashboard-v19-admin',
        JSON.stringify({
          visibleWidgets: ['top-customers', 'recent-orders', 'module-stats'],
          layout: [],
        })
      )
    })
    await gotoReady(page, '/dashboard')
    // Both widgets list the buyer by name — not "Walk-in Customer" / "Customer".
    await expect(page.getByText(BUYER, { exact: true }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(BUYER, { exact: true })).toHaveCount(2, { timeout: 30_000 })
  })

  test('Module Stats "New This Month" is the real count — past 200', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'prominent-dashboard-v19-admin',
        JSON.stringify({ visibleWidgets: ['module-stats'], layout: [] })
      )
    })
    const real = (await (
      await page.request.get('/api/crm/customers', {
        params: { createdFrom: manilaMonthStartIso(), limit: '1' },
      })
    ).json()) as { meta: { total: number } }
    // Every customer this fixture made is new this month, and there are > 200.
    expect(real.meta.total).toBeGreaterThan(200)

    await gotoReady(page, '/dashboard')
    const value = page
      .getByText('New This Month', { exact: true })
      .locator('xpath=following-sibling::p')
    await expect(value).toHaveText(String(real.meta.total), { timeout: 30_000 })
  })
})
