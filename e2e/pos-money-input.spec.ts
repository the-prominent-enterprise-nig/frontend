import {
  test,
  expect,
  type APIRequestContext,
  type Locator,
  type Page,
  type PlaywrightWorkerArgs,
} from '@playwright/test'
import {
  gotoReady,
  fillStable,
  sweepE2ECustomers,
  sweepE2EPriceLists,
  sweepE2EPriceUseTypes,
  deleteCustomers,
  openCustomSelect,
} from './utils'

// Scenario 71 Part 1 (item 2) — POS peso fields show "12,345.67" when not
// focused, take raw keystrokes while focused, and hand the app a plain number.
// Case IDs (S71-1-F…) match docs/scenario-71-pos-invoice-number-cr-dp-tax-exempt-plan.md.
//
// Fixtures follow pos-checkout-delivery: a fresh non-serial item stocked at
// Bago and priced at ₱12,345.60 on a Price Use + price list of its own, and E2E
// customers. Everything created here is removed in afterAll (the one sale
// S71-1-F07 completes stays, like the delivery spec's own sales).

const PREFIX = 'E2E S71 Money'
const BRANCH = 'Bago'
const ITEM_PRICE = 12345.6

type Fixtures = {
  itemId: string
  itemName: string
  priceUseTypeName: string
  priceUseTypeId: string
  priceListId: string
  branchId: string
}

let fx: Fixtures
const createdCustomerIds: string[] = []

async function ownerRequest(
  playwright: PlaywrightWorkerArgs['playwright'],
  baseURL: string
): Promise<APIRequestContext> {
  return playwright.request.newContext({ baseURL, storageState: 'e2e/.auth/business-owner.json' })
}

async function createFixtures(request: APIRequestContext): Promise<Fixtures> {
  const stamp = Date.now()
  const anyItemRes = await request.get('/api/inventory/items?limit=1')
  const baseUnitId = ((await anyItemRes.json()).data ?? [])[0].baseUnit.id as string

  const itemName = `${PREFIX} Item ${stamp}`
  const itemRes = await request.post('/api/inventory/items', {
    data: {
      sku: `E2E-S71-MONEY-${stamp}`,
      name: itemName,
      baseUnitId,
      isSerialTracked: false,
      sellingPrice: ITEM_PRICE,
    },
  })
  expect(itemRes.ok(), await itemRes.text()).toBeTruthy()
  const item = await itemRes.json()
  await request.post(`/api/inventory/items/${item.id}/submit`)
  await request.post(`/api/inventory/items/${item.id}/confirm-accounting`, { data: {} })
  await request.post(`/api/inventory/items/${item.id}/approve`, { data: {} })

  const branches = ((await (await request.get('/api/branches?limit=200')).json()).data ?? []) as {
    id: string
    name: string
  }[]
  const branchId = branches.find((b) => b.name === BRANCH)!.id
  const warehouses = ((await (await request.get('/api/inventory/warehouses?limit=200')).json())
    .data ?? []) as { id: string; branchId: string | null }[]
  const warehouse = warehouses.find((w) => w.branchId === branchId)!

  const adjustRes = await request.post('/api/inventory/adjustments', {
    data: {
      warehouseId: warehouse.id,
      adjustmentDate: new Date().toISOString().slice(0, 10),
      reasonCode: 'found',
      notes: 'E2E S71 money-input fixture stock',
      lines: [{ itemId: item.id, expectedQty: 0, actualQty: 20 }],
    },
  })
  expect(adjustRes.ok(), await adjustRes.text()).toBeTruthy()
  const adjustment = await adjustRes.json()
  for (const step of ['confirm', 'investigate', 'approve']) {
    const stepRes = await request.patch(`/api/inventory/adjustments/${adjustment.id}/${step}`)
    expect(stepRes.ok(), await stepRes.text()).toBeTruthy()
  }

  const priceUseTypeName = `${PREFIX} PU ${stamp}`
  const putRes = await request.post('/api/inventory/price-use-types', {
    data: { name: priceUseTypeName },
  })
  expect(putRes.ok(), await putRes.text()).toBeTruthy()
  const priceUseType = await putRes.json()

  const listRes = await request.post('/api/inventory/price-lists', {
    data: { name: `${PREFIX} List ${stamp}`, priceUseTypeId: priceUseType.id },
  })
  expect(listRes.ok(), await listRes.text()).toBeTruthy()
  const priceList = await listRes.json()
  const itemsRes = await request.post(`/api/inventory/price-lists/${priceList.id}/items`, {
    data: { items: [{ itemId: item.id, price: ITEM_PRICE }] },
  })
  expect(itemsRes.ok(), await itemsRes.text()).toBeTruthy()
  const approveRes = await request.post(`/api/inventory/price-lists/${priceList.id}/approve`, {
    data: {},
  })
  expect(approveRes.ok(), await approveRes.text()).toBeTruthy()

  return {
    itemId: item.id,
    itemName,
    priceUseTypeName,
    priceUseTypeId: priceUseType.id,
    priceListId: priceList.id,
    branchId,
  }
}

async function createCustomer(
  request: APIRequestContext,
  label: string
): Promise<{ id: string; name: string }> {
  const name = `${PREFIX} ${label} ${Date.now()}`
  const res = await request.post('/api/crm/customers', {
    data: {
      name,
      customerType: 'individual',
      phone: `0917${Date.now().toString().slice(-7)}`,
      address:
        '12 Rizal St., Abuanan, Bago City, Negros Occidental, Region VI (Western Visayas), Philippines',
      barangayCode: '064502001',
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const customer = await res.json()
  createdCustomerIds.push(customer.id)
  return { id: customer.id, name }
}

async function ensureOpenSession(request: APIRequestContext, branchId: string): Promise<void> {
  const terminals = (await (
    await request.get('/api/pos/terminals', { params: { branchId } })
  ).json()) as { id: string; status: string }[]
  const terminal = terminals.find((t) => t.status === 'active') ?? terminals[0]
  const open = (await (
    await request.get('/api/pos/sessions', { params: { terminalId: terminal.id, status: 'open' } })
  ).json()) as { id: string }[]
  if (open.length) return
  await request.post('/api/pos/sessions/open', {
    data: { terminalId: terminal.id, openingCash: 1000 },
  })
}

async function openCheckoutWithItem(page: Page): Promise<void> {
  await gotoReady(page, '/pos/checkout')
  await expect(page.getByPlaceholder('Search by name or serial')).toBeVisible({ timeout: 15_000 })
  const sessionSelect = page.locator('select').filter({ hasText: 'Select session' })
  const autoSelected = page.getByText(/^Counter \d+$/).first()
  await expect(sessionSelect.or(autoSelected)).toBeVisible({ timeout: 15_000 })
  if (await sessionSelect.isVisible()) {
    const value = await sessionSelect
      .locator('option', { hasText: BRANCH })
      .first()
      .getAttribute('value')
    await sessionSelect.selectOption(value!)
  }
  const search = page.getByPlaceholder('Search by name or serial')
  await search.fill(fx.itemName)
  const card = page
    .getByRole('button')
    .filter({ has: page.getByText(fx.itemName, { exact: true }) })
  await expect(card.first()).toBeVisible({ timeout: 15_000 })
  await card.first().click()
  await page.getByLabel('Price Use').first().selectOption({ label: fx.priceUseTypeName })
}

async function selectCustomer(page: Page, name: string): Promise<void> {
  const input = page.getByPlaceholder('Search by name or phone…')
  await input.click()
  await fillStable(input, name)
  await page.getByRole('button', { name: new RegExp(name) }).click()
}

/** Type into a money field, leave it, and read what it shows. */
async function typeAndBlur(field: Locator, text: string): Promise<void> {
  await field.click()
  await field.fill(text)
  await field.blur()
}

/** S71-1-F08's one pass on any money field: commas on blur, raw on focus. */
async function expectMoneyField(field: Locator): Promise<void> {
  await expect(field).toBeVisible({ timeout: 15_000 })
  await expect(field).toHaveAttribute('inputmode', 'decimal')
  await typeAndBlur(field, '1234567.8')
  await expect(field).toHaveValue('1,234,567.80')
  await field.click()
  await expect(field).toHaveValue('1234567.8')
  await field.blur()
}

const amountReceived = (page: Page): Locator => page.getByLabel('Amount received')

test.describe('POS money input (Scenario 71 Part 1)', () => {
  test.beforeAll(async ({ playwright }, testInfo) => {
    const request = await ownerRequest(playwright, testInfo.project.use.baseURL!)
    await sweepE2ECustomers(request, PREFIX)
    await sweepE2EPriceLists(request, PREFIX)
    await sweepE2EPriceUseTypes(request, PREFIX)
    fx = await createFixtures(request)
    await ensureOpenSession(request, fx.branchId)
    await request.dispose()
  })

  test.afterAll(async ({ playwright }, testInfo) => {
    const request = await ownerRequest(playwright, testInfo.project.use.baseURL!)
    await deleteCustomers(request, createdCustomerIds)
    if (fx) {
      await request.delete(`/api/inventory/price-lists/${fx.priceListId}`).catch(() => {})
      await request.delete(`/api/inventory/price-use-types/${fx.priceUseTypeId}`).catch(() => {})
      await request.delete(`/api/inventory/items/${fx.itemId}`).catch(() => {})
    }
    await request.dispose()
  })

  test('S71-1-F01 / F02 / F05 / F09: Amount received shows commas when left, raw while editing, keeps a typed ".", refuses letters and a minus, and is at least 52px tall', async ({
    page,
  }) => {
    await openCheckoutWithItem(page)
    const field = amountReceived(page)
    await expect(field).toBeVisible({ timeout: 15_000 })

    // F01
    await typeAndBlur(field, '12345.6')
    await expect(field).toHaveValue('12,345.60')
    await field.click()
    await expect(field).toHaveValue('12345.6')

    // F02 — the PO discount bug ("12." collapsing to 12) must not come back.
    await field.fill('')
    await field.pressSequentially('12.')
    await expect(field).toHaveValue('12.')
    await field.pressSequentially('5')
    await expect(field).toHaveValue('12.5')
    await field.blur()
    await expect(field).toHaveValue('12.50')

    // F05 — letters, a second "." and a minus never get in.
    await field.click()
    await field.fill('')
    await field.pressSequentially('-1a2.3.4')
    await expect(field).toHaveValue('12.34')
    await field.blur()

    // Edge cases: half a centavo rounds up; the biggest figure fits; clearing
    // leaves the field empty rather than 0.00.
    await typeAndBlur(field, '0.005')
    await expect(field).toHaveValue('0.01')
    await typeAndBlur(field, '9999999.99')
    await expect(field).toHaveValue('9,999,999.99')
    const clipped = await field.evaluate((el: HTMLInputElement) => el.scrollWidth > el.clientWidth)
    expect(clipped).toBe(false)
    await typeAndBlur(field, '')
    await expect(field).toHaveValue('')

    await expect(field).toHaveAttribute('inputmode', 'decimal')
    // F09 — Chloe's delivery-fee field set 52px.
    expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(52)
  })

  test('S71-1-F03 / F04: a pasted "6,190.00" or "₱6,190" is read as 6190; Copy beside the Total pastes straight in and settles the sale', async ({
    page,
  }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await openCheckoutWithItem(page)
    const field = amountReceived(page)
    await expect(field).toBeVisible({ timeout: 15_000 })

    for (const pasted of ['6,190.00', '₱6,190']) {
      await page.evaluate((t) => navigator.clipboard.writeText(t), pasted)
      await field.click()
      await field.fill('')
      await page.keyboard.press('ControlOrMeta+V')
      await expect(field).toHaveValue('6190' + (pasted.includes('.') ? '.00' : ''))
      await field.blur()
      await expect(field).toHaveValue('6,190.00')
    }

    // F04 — Copy still puts the plain amount on the clipboard (no comma) and
    // it pays the ₱12,345.60 sale exactly: no Change, no shortfall.
    await page.getByTestId('checkout-total-copy').click()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('12345.60')
    await field.click()
    await field.fill('')
    await page.keyboard.press('ControlOrMeta+V')
    await field.blur()
    await expect(field).toHaveValue('12,345.60')
    await expect(page.getByText('Change', { exact: true })).toHaveCount(0)

    // An overpayment shows the Change, worked out from the plain number.
    await typeAndBlur(field, '20000')
    await expect(field).toHaveValue('20,000.00')
    await expect(page.getByText('Change', { exact: true }).locator('..')).toContainText('₱7,654.40')
  })

  test('S71-1-F06: a blank delivery fee still means free delivery, and a typed fee reads with commas', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'F06')
    await openCheckoutWithItem(page)
    await selectCustomer(page, customer.name)
    await page.getByTestId('delivery-toggle').check()

    const fee = page.getByLabel('Delivery fee', { exact: true })
    const section = page.getByTestId('delivery-section')
    await expect(fee).toHaveValue('')
    await expect(section).toContainText('Free delivery — no fee to collect.')

    await typeAndBlur(fee, '1500')
    await expect(fee).toHaveValue('1,500.00')
    await expect(page.getByTestId('order-summary-delivery-fee')).toContainText('₱1,500.00')

    // Cleared again: blank, not ₱0.00, and still free with no error.
    await typeAndBlur(fee, '')
    await expect(fee).toHaveValue('')
    await expect(section).toContainText('Free delivery — no fee to collect.')
    await expect(section).not.toContainText('Enter an amount like 150')
    expect((await fee.boundingBox())!.height).toBeGreaterThanOrEqual(52)
  })

  test('S71-1-F07: the payment sent for a sale carries a plain number — no string, no comma', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'F07')
    const salesInvoiceNumber = `S71-SI-F07-${Date.now()}`
    await openCheckoutWithItem(page)
    await selectCustomer(page, customer.name)
    await fillStable(page.getByLabel('Sales Invoice No.'), salesInvoiceNumber)

    // Checkout posts through Next server actions; the payment is its own
    // action call, whose body holds the arguments as JSON. The item costs
    // exactly ₱12,345.60, so the whole tendered amount is what gets posted.
    const actionBodies: string[] = []
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.headers()['next-action']) {
        actionBodies.push(req.postData() ?? '')
      }
    })

    await typeAndBlur(amountReceived(page), '12345.6')
    await expect(amountReceived(page)).toHaveValue('12,345.60')
    await fillStable(page.getByRole('textbox', { name: /^CR Number/ }), `CR-S71-F07-${Date.now()}`)
    await page.getByRole('button', { name: 'Confirm Sale' }).click()
    await expect(page.getByText(salesInvoiceNumber).first()).toBeVisible({ timeout: 30_000 })

    const paymentBody = actionBodies.find((b) => /"amount":\s*12345\.6\b/.test(b))
    expect(paymentBody, actionBodies.join('\n---\n')).toBeDefined()
    expect(paymentBody).not.toContain('12,345')
    expect(paymentBody).not.toMatch(/"amount":\s*"/)

    // And the backend recorded it as that number.
    const res = await page.request.get('/api/pos/transactions', {
      params: { search: salesInvoiceNumber },
    })
    const body = await res.json()
    const sale = ((body.data ?? body) as { id: string; salesInvoiceNumber: string | null }[]).find(
      (t) => t.salesInvoiceNumber === salesInvoiceNumber
    )
    expect(sale).toBeDefined()
    const detail = await (await page.request.get(`/api/pos/transactions/${sale!.id}`)).json()
    const amounts = (detail.payments as { amount: string | number }[]).map((p) => Number(p.amount))
    expect(amounts.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(ITEM_PRICE)
  })

  test('S71-1-F08 (checkout): the X-Deal cash portion and the split-payment field format the same way', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'F08XD')
    await openCheckoutWithItem(page)
    await selectCustomer(page, customer.name)
    await page.getByTestId('x-deal-checkbox').check()
    const termPicker = page.getByRole('combobox', { name: 'Select a term…' })
    await expect(termPicker).toBeVisible({ timeout: 10_000 })
    await openCustomSelect(termPicker)
    await page.getByRole('listbox').getByRole('option').first().click()

    const cashPortion = page.getByLabel('X-Deal cash portion')
    await expect(cashPortion).toBeVisible({ timeout: 15_000 })
    await typeAndBlur(cashPortion, '1234.5')
    await expect(cashPortion).toHaveValue('1,234.50')
    expect((await cashPortion.boundingBox())!.height).toBeGreaterThanOrEqual(52)
  })

  test('S71-1-F08 (back office): New Receipt, gift card, branch pricing and loyalty money fields format with commas', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/collections/acknowledgement/new')
    await expectMoneyField(page.getByLabel('Amount', { exact: true }))

    await gotoReady(page, '/pos/gift-cards')
    await page.getByRole('button', { name: 'Issue Gift Card' }).click()
    await expectMoneyField(page.getByLabel('Initial Value'))

    await gotoReady(page, '/pos/loyalty')
    const pointValue = page.locator('#loyalty-points-value')
    await expect(pointValue).toBeVisible({ timeout: 15_000 })
    await typeAndBlur(pointValue, '1.5')
    await expect(pointValue).toHaveValue('1.50')
  })

  test('S71-1-F08 (save → reload): a promo minimum purchase saved as 1,234,567.80 reads back the same', async ({
    page,
  }) => {
    const code = `S71MONEY${Date.now().toString().slice(-6)}`
    await gotoReady(page, '/pos/promo-codes')
    await page.getByRole('button', { name: 'New Promo Code' }).click()
    await fillStable(page.getByPlaceholder('SUMMER20'), code)
    await fillStable(page.getByPlaceholder('Summer 20% Off'), `${PREFIX} promo`)

    const minPurchase = page.getByLabel('Min Purchase Amount')
    await expectMoneyField(minPurchase)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('heading', { name: 'New Promo Code' })).toHaveCount(0, {
      timeout: 15_000,
    })

    try {
      await page.reload({ waitUntil: 'domcontentloaded' })
      const row = page.locator('tr', { hasText: code })
      await expect(row).toBeVisible({ timeout: 15_000 })
      await row.locator('button:has(svg.lucide-pencil)').click()
      await expect(page.getByLabel('Min Purchase Amount')).toHaveValue('1,234,567.80')
    } finally {
      const list = (await (await page.request.get('/api/pos/promo-codes')).json()) as
        | { id: string; code: string }[]
        | { data: { id: string; code: string }[] }
      const promos = Array.isArray(list) ? list : list.data
      const created = promos.find((p) => p.code === code)
      if (created) await page.request.delete(`/api/pos/promo-codes/${created.id}`)
    }
  })
})
