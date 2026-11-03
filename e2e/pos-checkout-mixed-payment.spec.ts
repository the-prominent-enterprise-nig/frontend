import {
  test,
  expect,
  type APIRequestContext,
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
  pickCartPriceUse,
} from './utils'

// Mixed payment at POS checkout: one sale tendered with several methods. The
// first payment is still the one the Payment Mode panel describes; "Add
// another payment method" makes every payment one block — Payment N, its
// method panel (the same pills and follow-ups), and directly below it that
// payment's own Amount received (plus its own reference number where its
// method asks for one). One payment already has that shape — method panel,
// then its Amount received right under it, below Delivery and Total — so
// adding a second moves nothing. CR Number: a sale has one only with a down payment
// (installment / TPF) — ONE for the whole transaction, however many payments;
// a sale without a down payment has no CR at all. With a single payment the
// method panel stays up in Payment Mode, as it always was; the moment a second
// is added, Payment 1's panel moves down into its own block.
// Confirm is never disabled for an incomplete payment — pressing it lists
// everything that's missing and sends nothing.
//
// Checkout posts through Next server actions, so a browser request listener
// never sees the backend call — what was recorded is read back through the
// API by the sale's Sales Invoice No.
//
// Fixtures follow pos-checkout-delivery: a fresh non-serial item stocked at
// Bago, priced on a Price Use + price list of its own.

const PREFIX = 'E2E MixedPay'
const BRANCH = 'Bago'
const ITEM_PRICE = 8000

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
  return playwright.request.newContext({
    baseURL,
    storageState: 'e2e/.auth/business-owner.json',
  })
}

async function createFixtures(request: APIRequestContext): Promise<Fixtures> {
  const stamp = Date.now()

  const anyItemRes = await request.get('/api/inventory/items?limit=1')
  const baseUnitId = ((await anyItemRes.json()).data ?? [])[0].baseUnit.id as string

  const itemName = `${PREFIX} Item ${stamp}`
  const itemRes = await request.post('/api/inventory/items', {
    data: {
      sku: `E2E-MIXEDPAY-${stamp}`,
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
      notes: 'E2E mixed payment fixture stock',
      lines: [{ itemId: item.id, expectedQty: 0, actualQty: 50 }],
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

async function pickSessionIfAsked(page: Page): Promise<void> {
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
}

async function addItem(page: Page): Promise<void> {
  const search = page.getByPlaceholder('Search by name or serial')
  await expect(search).toBeVisible({ timeout: 15_000 })
  await search.fill(fx.itemName)
  const card = page
    .getByRole('button')
    .filter({ has: page.getByText(fx.itemName, { exact: true }) })
  await expect(card.first()).toBeVisible({ timeout: 15_000 })
  await card.first().click()
  await pickCartPriceUse(page, fx.priceUseTypeName)
}

async function selectCustomer(page: Page, name: string): Promise<void> {
  const input = page.getByPlaceholder('Search by name or phone…')
  await input.click()
  await fillStable(input, name)
  await page.getByRole('button', { name: new RegExp(name) }).click()
}

/** A cash sale in the cart, ready for its payment: customer, Sales Invoice No. */
async function readyCashSale(page: Page, label: string, salesInvoiceNumber: string) {
  const customer = await createCustomer(page.request, label)
  await gotoReady(page, '/pos/checkout')
  await pickSessionIfAsked(page)
  await addItem(page)
  await selectCustomer(page, customer.name)
  await fillStable(page.getByLabel('Sales Invoice No.'), salesInvoiceNumber)
  return customer
}

const confirm = (page: Page) => page.getByRole('button', { name: /Confirm Sale|Underpaid by/ })
const addAnother = (page: Page) => page.getByTestId('add-another-payment')
const amount = (page: Page, i: number) => page.getByTestId(`payment-amount-${i}`)
const reference = (page: Page, i: number) => page.getByTestId(`payment-reference-${i}`)

/** The second payment's panel, switched to GCash (a QR tender: its CR is required). */
async function payAnotherWithGcash(page: Page, i = 1) {
  await page
    .getByTestId(`payment-panel-${i}`)
    .getByRole('button', { name: 'GCash', exact: true })
    .click()
}

async function salesBySalesInvoice(request: APIRequestContext, salesInvoiceNumber: string) {
  const res = await request.get('/api/pos/transactions', {
    params: { search: salesInvoiceNumber },
  })
  const body = await res.json()
  return ((body.data ?? body) as { id: string; salesInvoiceNumber: string | null }[]).filter(
    (t) => t.salesInvoiceNumber === salesInvoiceNumber
  )
}

async function paymentsOf(request: APIRequestContext, salesInvoiceNumber: string) {
  const [sale] = await salesBySalesInvoice(request, salesInvoiceNumber)
  const detail = await (await request.get(`/api/pos/transactions/${sale.id}`)).json()
  return (
    detail.payments as { paymentMethod: string; amount: string; referenceNumber: string | null }[]
  ).map((p) => ({
    method: p.paymentMethod,
    amount: Number(p.amount),
    reference: p.referenceNumber,
  }))
}

test.describe('POS Checkout — Mixed payment', () => {
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

  test('MP-F01: a single payment is its method panel with the Amount received right under it — Add another appears only while something is unpaid', async ({
    page,
  }) => {
    await readyCashSale(page, 'F01', `SI-MPF01-${Date.now()}`)

    await expect(page.getByLabel('Amount received')).toBeVisible()
    await expect(page.getByTestId('mixed-payments')).toHaveCount(0)
    // The method panel and the amount are one block, the amount under the panel,
    // both below the Total.
    const unit0 = page.getByTestId('payment-unit-0')
    await expect(unit0.getByTestId('cash-sub-mode-toggle')).toBeVisible()
    const y = async (id: string) => (await page.getByTestId(id).boundingBox())!.y
    expect(await y('checkout-grand-total')).toBeLessThan(await y('cash-sub-mode-toggle'))
    expect(await y('cash-sub-mode-toggle')).toBeLessThan(await y('payment-amount-0'))
    await expect(addAnother(page)).toBeVisible()

    await fillStable(page.getByLabel('Amount received'), '8000')
    await expect(addAnother(page)).toHaveCount(0)
  })

  test('MP-F12: adding a second payment moves nothing — Payment 1 keeps its place under the Total', async ({
    page,
  }) => {
    await readyCashSale(page, 'F12', `SI-MPF12-${Date.now()}`)
    await fillStable(page.getByLabel('Amount received'), '3000')
    // Where the first payment's method panel and amount sit, measured from the
    // Total (both scroll together, so the gap does not depend on scrolling).
    const fromTotal = async (id: string) =>
      (await page.getByTestId(id).boundingBox())!.y -
      (await page.getByTestId('checkout-grand-total').boundingBox())!.y
    const panelBefore = await fromTotal('cash-sub-mode-toggle')
    const amountBefore = await fromTotal('payment-amount-0')

    await addAnother(page).click()
    await expect(page.getByTestId('payment-unit-1')).toBeVisible()
    // The page scrolls to the new block; measure again against the Total.
    await page.getByTestId('checkout-grand-total').scrollIntoViewIfNeeded()
    expect(Math.abs((await fromTotal('cash-sub-mode-toggle')) - panelBefore)).toBeLessThan(2)
    expect(Math.abs((await fromTotal('payment-amount-0')) - amountBefore)).toBeLessThan(2)
  })

  test('MP-F02: Add another repeats the payment method panel, with the unpaid balance already in the new amount; the running figures follow', async ({
    page,
  }) => {
    await readyCashSale(page, 'F02', `SI-MPF02-${Date.now()}`)
    await fillStable(page.getByLabel('Amount received'), '3000')
    await addAnother(page).click()

    // Every payment is one block with the same shape: heading, method panel,
    // then its Amount received and CR Number directly below the panel.
    await expect(page.getByTestId('mixed-payments')).toBeVisible()
    const unit0 = page.getByTestId('payment-unit-0')
    const unit1 = page.getByTestId('payment-unit-1')
    await expect(unit0).toContainText('Payment 1')
    await expect(unit1).toContainText('Payment 2')
    // Payment 1's panel is now inside its block (it left Payment Mode)...
    await expect(unit0.getByTestId('cash-sub-mode-toggle')).toBeVisible()
    await expect(page.getByTestId('cash-sub-mode-toggle')).toHaveCount(1)
    // ...and Payment 2's pills are the same ones.
    const panel = page.getByTestId('payment-panel-1')
    for (const name of ['Cash on Hand', 'Check', 'Bank Transfer', 'GCash', 'Billers', 'QR']) {
      await expect(panel.getByRole('button', { name, exact: true })).toBeVisible()
    }

    const y = async (id: string) => (await page.getByTestId(id).boundingBox())!.y
    const panel0Y = await y('cash-sub-mode-toggle')
    const amount0Y = await y('payment-amount-0')
    const panel1Y = await y('payment-panel-1')
    const amount1Y = await y('payment-amount-1')
    const cr1Y = await y('payment-reference-1')
    // Panel above its own amount, block after block; Payment 2 (opened on card)
    // asks for its own reference under its amount, Payment 1 (cash) for none.
    await expect(page.getByTestId('payment-reference-0')).toHaveCount(0)
    expect(panel0Y).toBeLessThan(amount0Y)
    expect(amount0Y).toBeLessThan(panel1Y)
    expect(panel1Y).toBeLessThan(amount1Y)
    expect(amount1Y).toBeLessThan(cr1Y)
    await expect(amount(page, 1)).toHaveValue('5000')
    await expect(page.getByTestId('payment-paid-so-far')).toHaveText('₱8,000.00')
    await expect(page.getByTestId('payment-remaining')).toHaveText('₱0.00')

    await fillStable(amount(page, 1), '2000')
    await expect(page.getByTestId('payment-remaining')).toHaveText('₱3,000.00')
  })

  test('MP-F03: Confirm is never disabled — an incomplete payment lists what is missing, marks the fields and sends nothing', async ({
    page,
  }) => {
    const salesInvoiceNumber = `SI-MPF03-${Date.now()}`
    await readyCashSale(page, 'F03', salesInvoiceNumber)
    await fillStable(page.getByLabel('Amount received'), '3000')
    await addAnother(page).click()
    await payAnotherWithGcash(page)
    // GCash needs its CR; nothing typed.
    await expect(confirm(page)).toBeEnabled()
    await confirm(page).click()

    const issues = page.getByTestId('payment-issues')
    await expect(issues).toContainText("You're missing:")
    await expect(issues).toContainText('Payment 2 — GCash reference')
    await expect(reference(page, 1)).toHaveClass(/border-red-400/)

    // Filling the gap clears it live.
    await fillStable(reference(page, 1), `CR-MPF03-${Date.now()}`)
    await expect(issues).toHaveCount(0)

    // Nothing was posted by the failed attempt.
    expect(await salesBySalesInvoice(page.request, salesInvoiceNumber)).toHaveLength(0)
  })

  test('MP-F04: unpaid balance and a missing amount are both listed', async ({ page }) => {
    await readyCashSale(page, 'F04', `SI-MPF04-${Date.now()}`)
    await fillStable(page.getByLabel('Amount received'), '3000')
    await addAnother(page).click()
    await amount(page, 1).fill('')
    await expect(amount(page, 1)).toHaveValue('')
    await confirm(page).click()

    const issues = page.getByTestId('payment-issues')
    await expect(issues).toContainText('Payment 2 — amount received')
    await expect(issues).toContainText('₱5,000.00 still unpaid')
    await expect(page.getByTestId('payment-remaining')).toHaveText('₱5,000.00')
  })

  test('MP-F05: cash and GCash record as two payments — GCash with its own reference, cash with none', async ({
    page,
  }) => {
    const salesInvoiceNumber = `SI-MPF05-${Date.now()}`
    await readyCashSale(page, 'F05', salesInvoiceNumber)
    await fillStable(
      page.getByLabel('Payment 1 amount received').or(page.getByLabel('Amount received')),
      '3000'
    )
    await addAnother(page).click()
    await payAnotherWithGcash(page)
    await fillStable(reference(page, 1), 'GCASH-MPF05-B')
    await confirm(page).click()

    await expect(page.getByText('Sale Complete').or(page.getByText(/Sale completed/i))).toBeVisible(
      { timeout: 30_000 }
    )
    const payments = await paymentsOf(page.request, salesInvoiceNumber)
    expect(payments).toHaveLength(2)
    expect(payments).toEqual(
      expect.arrayContaining([
        { method: 'cash', amount: 3000, reference: null },
        { method: 'qr', amount: 5000, reference: 'GCASH-MPF05-B' },
      ])
    )
  })

  test('MP-F06: only cash gives change — the change comes off the cash row, the GCash row keeps what it received', async ({
    page,
  }) => {
    const salesInvoiceNumber = `SI-MPF06-${Date.now()}`
    await readyCashSale(page, 'F06', salesInvoiceNumber)
    await fillStable(page.getByLabel('Amount received'), '5000')
    await addAnother(page).click()
    await payAnotherWithGcash(page)
    await fillStable(amount(page, 1), '5000')
    await fillStable(reference(page, 1), 'GCASH-MPF06')
    await expect(page.getByText('Change', { exact: true })).toBeVisible()
    await confirm(page).click()

    await expect(page.getByText(/Change: ₱2,000\.00/)).toBeVisible({ timeout: 30_000 })
    const payments = await paymentsOf(page.request, salesInvoiceNumber)
    expect(payments).toEqual(
      expect.arrayContaining([
        { method: 'cash', amount: 3000, reference: null },
        { method: 'qr', amount: 5000, reference: 'GCASH-MPF06' },
      ])
    )
  })

  test('MP-F07: a non-cash payment cannot be more than the sale — only cash gives change', async ({
    page,
  }) => {
    const salesInvoiceNumber = `SI-MPF07-${Date.now()}`
    await readyCashSale(page, 'F07', salesInvoiceNumber)
    await fillStable(page.getByLabel('Amount received'), '1000')
    await addAnother(page).click()
    await payAnotherWithGcash(page)
    await fillStable(amount(page, 1), '9000')
    await fillStable(reference(page, 1), 'GCASH-MPF07')
    await confirm(page).click()

    await expect(page.getByTestId('payment-issues')).toContainText(
      'Payment 2 — more than the ₱8,000.00 due (only cash gives change)'
    )
    expect(await salesBySalesInvoice(page.request, salesInvoiceNumber)).toHaveLength(0)
  })

  test('MP-F08: removing the extra payment goes back to the single payment', async ({ page }) => {
    await readyCashSale(page, 'F08', `SI-MPF08-${Date.now()}`)
    await fillStable(page.getByLabel('Amount received'), '3000')
    await addAnother(page).click()
    await expect(page.getByTestId('mixed-payments')).toBeVisible()
    await page.getByTestId('payment-remove-1').click()

    await expect(page.getByTestId('mixed-payments')).toHaveCount(0)
    await expect(page.getByTestId('payment-panel-1')).toHaveCount(0)
    // Back to one payment: its panel and amount are where they were.
    await expect(page.getByTestId('cash-sub-mode-toggle')).toBeVisible()
    await expect(page.getByTestId('payment-unit-0')).toHaveCount(1)
    await expect(addAnother(page)).toBeVisible()
    await expect(page.getByLabel('Amount received')).toHaveValue('3000')
    await expect(page.getByTestId('payment-summary')).toHaveCount(0)
  })

  test("MP-F09: the added panel follows the same rules as the first — Check asks for a number, Bank Transfer for 'verified', and a missing Check Number is listed", async ({
    page,
  }) => {
    await readyCashSale(page, 'F09', `SI-MPF09-${Date.now()}`)
    await fillStable(page.getByLabel('Amount received'), '3000')
    await addAnother(page).click()
    const panel = page.getByTestId('payment-panel-1')

    await panel.getByRole('button', { name: 'Bank Transfer', exact: true }).click()
    await expect(panel.getByText('Verified at register', { exact: false })).toBeVisible()

    await panel.getByRole('button', { name: 'Check', exact: true }).click()
    await expect(page.getByTestId('payment-check-1')).toBeVisible()
    await expect(panel.getByText('Verified at register', { exact: false })).toHaveCount(0)

    await confirm(page).click()
    await expect(page.getByTestId('payment-issues')).toContainText('Payment 2 — Check Number')
    await expect(page.getByTestId('payment-check-1')).toHaveClass(/border-red-400/)
  })

  test('MP-F10: a sale without a down payment has no CR Number — cash asks for no reference; GCash, card and bank transfer ask for their own', async ({
    page,
  }) => {
    const salesInvoiceNumber = `SI-MPF10-${Date.now()}`
    await readyCashSale(page, 'F10', salesInvoiceNumber)
    const crBox = page.getByRole('textbox', { name: /^CR Number/ })

    // Cash: nothing to enter besides the amount.
    await expect(crBox).toHaveCount(0)
    await expect(page.getByLabel(/reference$/)).toHaveCount(0)

    // GCash (a QR tender): its own reference appears, and is required — it is a
    // reference number, not a CR.
    await page
      .getByTestId('cash-sub-mode-toggle')
      .getByRole('button', { name: 'GCash', exact: true })
      .click()
    await expect(page.getByLabel('GCash reference')).toBeVisible()
    await expect(crBox).toHaveCount(0)
    await fillStable(page.getByLabel('Amount received'), '8000')
    await confirm(page).click()
    await expect(page.getByText('GCash reference is required.')).toBeVisible()
    expect(await salesBySalesInvoice(page.request, salesInvoiceNumber)).toHaveLength(0)

    // Back to cash: no field, and the sale goes through with no reference at all.
    await page
      .getByTestId('cash-sub-mode-toggle')
      .getByRole('button', { name: 'Cash on Hand', exact: true })
      .click()
    await expect(page.getByLabel(/reference$/)).toHaveCount(0)
    await confirm(page).click()
    await expect(page.getByText('Sale Complete').or(page.getByText(/Sale completed/i))).toBeVisible(
      { timeout: 30_000 }
    )
    expect(await paymentsOf(page.request, salesInvoiceNumber)).toEqual([
      { method: 'cash', amount: 8000, reference: null },
    ])
  })

  test('MP-F11: a down-payment sale has ONE CR Number for the whole transaction, however many payments, and it goes on every payment', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'F11')
    const salesInvoiceNumber = `SI-MPF11-${Date.now()}`
    await gotoReady(page, '/pos/checkout')
    await pickSessionIfAsked(page)
    await addItem(page)
    await selectCustomer(page, customer.name)

    // An in-house installment line, credit application waived (Business Owner).
    await page.getByRole('button', { name: 'Installment', exact: true }).click()
    await expect(page.getByRole('combobox', { name: 'Select a term…' })).toBeVisible({
      timeout: 10_000,
    })
    await page.getByTestId('credit-waiver-checkbox').check()
    await openCustomSelect(page.getByRole('combobox', { name: 'Select a term…' }))
    await page.getByRole('listbox').getByRole('option').first().click()
    const section = page.getByTestId('price-override-exception')
    await openCustomSelect(section.getByRole('combobox', { name: 'Pick a reason…' }))
    await page.getByRole('listbox').getByRole('option', { name: 'Management special' }).click()
    await fillStable(
      section.getByLabel('Note for the price override or typed terms'),
      'E2E mixed payment down payment'
    )
    await fillStable(page.getByLabel('Sales Invoice No.'), salesInvoiceNumber)
    await page
      .getByTestId('dp-payment-mode-toggle')
      .getByRole('button', { name: 'Cash', exact: true })
      .click()

    // The down payment, as the toggle states it.
    const dpText = await page.getByTestId('dp-payment-mode-toggle').innerText()
    const dp = Number(dpText.match(/₱([\d,]+\.\d{2})/)![1].replace(/,/g, ''))
    const half = Math.floor(dp / 2)

    // One payment: one CR Number.
    const crBox = page.getByRole('textbox', { name: /^CR Number/ })
    await expect(crBox).toHaveCount(1)
    await fillStable(page.getByLabel('Amount received'), String(half))

    // Two payments: still exactly one CR Number, none inside the blocks, and
    // no per-payment reference either.
    await addAnother(page).click()
    await expect(page.getByTestId('mixed-payments')).toBeVisible()
    await expect(crBox).toHaveCount(1)
    await expect(page.getByTestId('sale-cr-number')).toBeVisible()
    await expect(page.getByTestId('payment-reference-0')).toHaveCount(0)
    await expect(page.getByTestId('payment-reference-1')).toHaveCount(0)

    // Missing CR: one entry in the list, on the one field. (On an installment
    // cart the button reads "Create Installment Plan".)
    await page.getByRole('button', { name: /Create Installment Plan/ }).click()
    await expect(page.getByTestId('payment-issues')).toContainText('CR Number')
    await expect(page.getByTestId('sale-cr-number')).toHaveClass(/border-red-400/)

    await fillStable(page.getByTestId('sale-cr-number'), 'CR-MPF11')
    await page.getByRole('button', { name: /Create Installment Plan/ }).click()
    await expect(page.getByText('Installment Plan Created', { exact: true })).toBeVisible({
      timeout: 45_000,
    })

    // Both payments carry that one CR.
    const payments = await paymentsOf(page.request, salesInvoiceNumber)
    expect(payments.length).toBeGreaterThanOrEqual(2)
    expect(new Set(payments.map((p) => p.reference))).toEqual(new Set(['CR-MPF11']))
    expect(new Set(payments.map((p) => p.method)).size).toBeGreaterThanOrEqual(2)
  })

  test('MP-F13: the customer ledger names each payment — and a QR payment by its provider', async ({
    page,
  }) => {
    const salesInvoiceNumber = `SI-MPF13-${Date.now()}`
    const customer = await readyCashSale(page, 'F13', salesInvoiceNumber)
    await fillStable(page.getByLabel('Amount received'), '3000')
    await addAnother(page).click()
    await payAnotherWithGcash(page)
    await page.getByLabel('Payment 2 Gateway').click()
    await page.getByRole('option', { name: 'GCash Send Money' }).click()
    await fillStable(reference(page, 1), 'GCASH-MPF13')
    await confirm(page).click()
    await expect(page.getByText('Sale Complete').or(page.getByText(/Sale completed/i))).toBeVisible(
      { timeout: 30_000 }
    )

    const [sale] = await salesBySalesInvoice(page.request, salesInvoiceNumber)
    const res = await page.request.get(`/api/crm/customers/${customer.id}/ledger`, {
      params: { transactionId: `txn:${sale.id}` },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const rows = (await res.json()).rows as {
      description: string
      ref: string
      debit: number
      credit: number
    }[]
    expect(rows.map((r) => r.description)).toEqual([
      'Cash Sale',
      'Payment (Cash)',
      'Payment (GCash — GCash Send Money)',
    ])
    // The cash payment has no reference of its own, so it shows the invoice no.
    expect(rows[1].ref).toBe(salesInvoiceNumber)
    expect(rows[2].ref).toBe('GCASH-MPF13')
    expect(rows.reduce((sum, r) => sum + r.credit, 0)).toBe(rows[0].debit)
  })
})
