import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { gotoReady } from './utils'

// Docket #88 — "As Credit & Collection staff, I must be able to print a
// cash-sale ledger in the installment account format." A cash sale's printout
// is the installment account's paper form (Lastname / Firstname / Middle,
// Sales Invoice No., Brand / Type / Model / Serial, Agent / Collector / FMI,
// LCP …), read off the sale; what only an installment account has prints "—".
// It used to be the multi-purchase layout (customer line, "Items Purchased").

const STAMP = Date.now()
const SI = `SI-E2E88-${STAMP}`
const PRICE = 1234

/** `total` is what the sale recorded (tax included), which the ledger's Cash
 * Sale row and the printout's LCP / Total Price both read. */
type Fixture = {
  customerId: string
  saleId: string
  sessionId: string
  itemName: string
  total: number
}
let fixture: Fixture

async function unwrap<T>(res: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T[]> {
  expect(res.ok(), await res.text()).toBeTruthy()
  const body = await res.json()
  return (Array.isArray(body) ? body : (body.data ?? [])) as T[]
}

async function ok<T>(
  res: Awaited<ReturnType<APIRequestContext['post']>>,
  what: string
): Promise<T> {
  expect(res.ok(), `${what}: ${await res.text()}`).toBeTruthy()
  return (await res.json()) as T
}

/** A fresh customer whose one purchase is a ₱1,234 cash sale at Bago. */
async function seedCashSale(request: APIRequestContext): Promise<Fixture> {
  const branches = await unwrap<{ id: string; name: string }>(
    await request.get('/api/branches?limit=200')
  )
  const branch = branches.find((b) => b.name === 'Bago') ?? branches[0]
  const terminals = await unwrap<{ id: string; branchId: string | null }>(
    await request.get('/api/pos/terminals?limit=200')
  )
  const terminal = terminals.find((t) => t.branchId === branch.id)
  if (!terminal) throw new Error(`No terminal for ${branch.name}`)
  const open = await unwrap<{ id: string; terminalId: string }>(
    await request.get('/api/pos/sessions?status=open&limit=50')
  )
  for (const s of open.filter((s) => s.terminalId === terminal.id)) {
    await closeAtExpected(request, s.id)
  }
  const session = await ok<{ id: string }>(
    await request.post('/api/pos/sessions/open', {
      data: { terminalId: terminal.id, openingCash: 0 },
    }),
    'open session'
  )

  const items = await unwrap<{ id: string; name: string; isSerialTracked: boolean }>(
    await request.get('/api/inventory/items?limit=200')
  )
  const item = items.find((i) => !i.isSerialTracked)
  if (!item) throw new Error('No non-serial-tracked item')

  const customer = await ok<{ id: string }>(
    await request.post('/api/crm/customers', {
      data: {
        name: `E2E88 ${STAMP} Rojas`,
        firstName: `E2E88 ${STAMP}`,
        lastName: 'Rojas',
        sourceChannel: 'pos_walkin',
        phone: `09${String(STAMP).slice(-9)}`,
      },
    }),
    'create customer'
  )
  const sale = await ok<{ id: string; totalAmount: string | number }>(
    await request.post('/api/pos/transactions', {
      data: {
        sessionId: session.id,
        customerId: customer.id,
        salesInvoiceNumber: SI,
        subtotal: PRICE,
        totalAmount: PRICE,
        currency: 'PHP',
        lines: [{ itemId: item.id, itemName: item.name, quantity: 1, unitPrice: PRICE }],
      },
    }),
    'cash sale'
  )
  await ok(
    await request.post(`/api/pos/transactions/${sale.id}/payments`, {
      data: { paymentMethod: 'cash', amount: Number(sale.totalAmount) },
    }),
    'pay cash sale'
  )
  return {
    customerId: customer.id,
    saleId: sale.id,
    sessionId: session.id,
    itemName: item.name,
    total: Number(sale.totalAmount),
  }
}

/** Closes a session declaring exactly the expected cash, so no manager
 * override is needed (as pos-checkout-session-picker.spec.ts does): the first
 * try learns the difference from the refusal. */
async function closeAtExpected(request: APIRequestContext, sessionId: string): Promise<void> {
  const url = `/api/pos/sessions/${sessionId}/close`
  const first = await request.post(url, { data: { declaredClosingCash: 0 } })
  if (first.ok()) return
  const text = await first.text()
  const diff = Number(/by (-?[\d,]+(?:\.\d+)?)/.exec(text)?.[1]?.replace(/,/g, ''))
  expect(Number.isFinite(diff), text).toBeTruthy()
  const second = await request.post(url, { data: { declaredClosingCash: -diff } })
  expect(second.ok(), await second.text()).toBeTruthy()
}

async function printedHtml(page: Page): Promise<string> {
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Print' }).click()
  const popup = await popupPromise
  await expect(popup.locator('.letterhead')).toBeVisible({ timeout: 20_000 })
  await expect(popup.locator('.letterhead')).toContainText('Customer Ledger')
  return popup.content()
}

/** The installment account's paper form, filled from the cash sale. */
function expectInstallmentFormat(html: string): void {
  expect(html).toContain('class="form-grid"')
  expect(html).toContain('<p class="cell-label">Lastname</p>')
  expect(html).toContain('<p class="cell-value">Rojas</p>')
  expect(html).toContain(`<p class="cell-value">${SI}</p>`)
  expect(html).toContain('<p class="cell-label">Brand</p>')
  expect(html).toContain('<p class="cell-label">Collector</p>')
  // LCP and Total Price are the sale's amount; what only an installment
  // account has reads "—".
  const total = fixture.total.toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  })
  expect(html).toContain(`<p class="cell-value">${total}</p><p class="cell-label">LCP</p>`)
  expect(html).toContain(`<p class="cell-value">${total}</p><p class="cell-label">Total Price</p>`)
  expect(html).toContain('<p class="cell-value">—</p><p class="cell-label">Down</p>')
  expect(html).toContain('<p class="cell-value">—</p><p class="cell-label">Term</p>')
  expect(html).toContain('<p class="cell-label">Phone</p>')
  expect(html).toContain('Cash Sale')
  // Not the multi-purchase layout any more.
  expect(html).not.toContain('Items Purchased')
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(120_000)
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    storageState: 'e2e/.auth/business-owner.json',
  })
  fixture = await seedCashSale(context.request)
  await context.close()
})

test.afterAll(async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    storageState: 'e2e/.auth/business-owner.json',
  })
  if (fixture) await closeAtExpected(context.request, fixture.sessionId).catch(() => {})
  await context.close()
})

test('the ledger narrowed to a cash sale carries the sale’s own paper-form figures', async ({
  request,
}) => {
  const res = await request.get(`/api/crm/customers/${fixture.customerId}/ledger`, {
    params: { transactionId: `cash:${fixture.saleId}` },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const ledger = await res.json()
  expect(ledger.cashSale.salesInvoiceNumber).toBe(SI)
  expect(ledger.cashSale.customerName.lastName).toBe('Rojas')
  expect(ledger.cashSale.listedCashPrice).toBe(fixture.total)
  // The same figure as the ledger's own Cash Sale row.
  const saleRow = ledger.rows.find((r: { description: string }) => r.description === 'Cash Sale')
  expect(saleRow.debit).toBe(fixture.total)
  expect(ledger.cashSale.branch).toBeTruthy()
  expect(ledger.cashSale.units).toHaveLength(1)
  // The Business Owner may read agents, so the agent's pay comes too.
  expect(typeof ledger.cashSale.salesCommission).toBe('number')

  // The all-purchases ledger carries no card.
  const all = await (await request.get(`/api/crm/customers/${fixture.customerId}/ledger`)).json()
  expect(all.cashSale).toBeUndefined()
})

test('Print on a cash sale picked in the Transaction list is the installment account format', async ({
  page,
}) => {
  await gotoReady(
    page,
    `/crm/customers/${fixture.customerId}/ledger?transactionId=cash:${fixture.saleId}`
  )
  await expect(page.getByRole('button', { name: 'Print' })).toBeVisible({ timeout: 60_000 })
  expectInstallmentFormat(await printedHtml(page))
})

test('Print on a customer whose only purchase is a cash sale is the installment account format too', async ({
  page,
}) => {
  await gotoReady(page, `/crm/customers/${fixture.customerId}/ledger`)
  await expect(page.getByRole('button', { name: 'Print' })).toBeVisible({ timeout: 60_000 })
  expectInstallmentFormat(await printedHtml(page))
})
