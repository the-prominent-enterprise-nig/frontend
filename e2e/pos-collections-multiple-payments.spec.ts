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
  pickCartPriceUse,
} from './utils'

// POS Collections — a collection taken with several methods. Each payment is a
// block: its method (the same buttons POS checkout uses) with the Amount
// received right under it. The collection has ONE CR number, whatever the
// number of payments; each method gets its own receipt on it. Collect payment
// is never switched off for something missing — pressing it lists what is.
//
// The plan being collected is built through checkout (in-house installment,
// credit application waived by the Business Owner), as pos-checkout-mixed-
// payment MP-F11 does, so this spec needs no seeded customer or item.

const PREFIX = 'E2E CollectMulti'
const BRANCH = 'Bago'
const ITEM_PRICE = 12000

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
      sku: `E2E-COLLECTMULTI-${stamp}`,
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
      notes: 'E2E collections multi-payment fixture stock',
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

/** An in-house installment plan for a fresh customer, the credit application
 * waived (Business Owner) and the down payment taken in cash. */
async function createInstallmentPlan(page: Page, label: string) {
  const customer = await createCustomer(page.request, label)
  await gotoReady(page, '/pos/checkout')
  await pickSessionIfAsked(page)
  await addItem(page)
  await selectCustomer(page, customer.name)

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
    'E2E collections multi-payment fixture'
  )
  await fillStable(page.getByLabel('Sales Invoice No.'), `SI-CM-${label}-${Date.now()}`)
  await page
    .getByTestId('dp-payment-mode-toggle')
    .getByRole('button', { name: 'Cash', exact: true })
    .click()
  const dpText = await page.getByTestId('dp-payment-mode-toggle').innerText()
  const dp = Number(dpText.match(/₱([\d,]+\.\d{2})/)![1].replace(/,/g, ''))
  await fillStable(page.getByLabel('Amount received'), String(dp))
  await fillStable(page.getByLabel('CR Number'), `CR-CM-DP-${label}-${Date.now()}`)
  await page.getByRole('button', { name: /Create Installment Plan/ }).click()
  await expect(page.getByText('Installment Plan Created', { exact: true })).toBeVisible({
    timeout: 45_000,
  })
  return customer
}

/** Opens the collection panel on the plan's first due (the one picked). */
async function openFirstDue(page: Page, customerName: string): Promise<void> {
  await gotoReady(page, '/pos/collections')
  await fillStable(page.getByPlaceholder('Filter by name or phone…'), customerName)
  const row = page.locator('ul > li > button').filter({ hasText: customerName })
  await expect(row).toBeVisible({ timeout: 15_000 })
  await row.click()
  const due1 = page.locator('li').filter({ hasText: 'Payment 1 of' })
  await expect(due1).toBeVisible({ timeout: 15_000 })
  // A due is picked with its checkbox; one due opens "Collect Payment".
  await due1.getByRole('checkbox').check()
  await expect(page.getByRole('heading', { name: 'Collect Payment' })).toBeVisible()
  // The branch's methods load a moment after the panel opens; until they do
  // only Check is offered.
  await expect(
    page.getByTestId('collection-method-0').getByRole('button', { name: 'Debit/Credit Card' })
  ).toBeVisible({ timeout: 15_000 })
}

/** What the panel says is due, net of any rebate left ticked: the Net cell. */
async function netDue(page: Page): Promise<number> {
  const text = await page.locator('table tbody tr').first().locator('td').last().innerText()
  return Number(text.replace(/[^\d.]/g, ''))
}

/** What the amount box shows for a plain number: thousands grouped as typed. */
const grouped = (n: number | string) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
/** Types an amount and waits until the box shows it grouped (32323232 → 32,323,232). */
async function fillMoney(locator: Locator, value: string): Promise<void> {
  const [whole, decimals] = value.split('.')
  const shown = decimals === undefined ? grouped(whole) : `${grouped(whole)}.${decimals}`
  await expect(async () => {
    await locator.fill(value)
    await expect(locator).toHaveValue(shown)
  }).toPass({ timeout: 10_000 })
}

const collect = (page: Page) => page.getByRole('button', { name: 'Collect payment' })
const addAnother = (page: Page) => page.getByTestId('add-another-collection-payment')
const amount = (page: Page, i: number) => page.getByTestId(`collection-amount-${i}`)

/** The plan's payments, read back through the API. */
async function paymentsOf(request: APIRequestContext, customerId: string) {
  const schedules = (await (
    await request.get(`/api/pos/customers/${customerId}/installment-schedules`)
  ).json()) as { lines: { arInvoice: { id: string } }[] }[] | { data: unknown[] }
  const list = (Array.isArray(schedules) ? schedules : (schedules.data ?? [])) as {
    lines: { arInvoice: { id: string } }[]
  }[]
  const invoiceId = list[0].lines[0].arInvoice.id
  const invoice = await (await request.get(`/api/ar-invoices/${invoiceId}`)).json()
  return (
    invoice.payments as {
      method: string
      amount: string | number
      reference: string | null
      collectionReceiptId: string | null
      cancelledAt: string | null
    }[]
  ).filter((p) => !p.cancelledAt)
}

test.describe('POS Collections — several payments in one collection', () => {
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

  test('CM-F01: a single payment is its method with the Amount received right under it — Collect payment is never switched off, it lists what is missing', async ({
    page,
  }) => {
    const customer = await createInstallmentPlan(page, 'F01')
    const before = (await paymentsOf(page.request, customer.id)).length
    await openFirstDue(page, customer.name)

    const block = page.getByTestId('collection-payment-0')
    await expect(block).toContainText('Payment 1')
    const y = async (id: string) => (await page.getByTestId(id).boundingBox())!.y
    expect(await y('collection-method-0')).toBeLessThan(await y('collection-amount-0'))

    // Nothing typed: still clickable, and it says what is missing.
    await expect(collect(page)).toBeEnabled()
    await collect(page).click()
    const issues = page.getByTestId('collection-issues')
    await expect(issues).toContainText("You're missing:")
    await expect(issues).toContainText('Amount received')
    await expect(issues).toContainText('CR number')
    await expect(amount(page, 0)).toHaveClass(/border-red-400/)
    await expect(page.getByTestId('collection-cr-number')).toHaveClass(/border-red-400/)

    // Fills clear the list live; nothing was recorded by the refused click.
    await fillMoney(amount(page, 0), '100')
    await fillStable(page.getByTestId('collection-cr-number'), 'CR-CM-F01')
    await expect(issues).toHaveCount(0)
    expect((await paymentsOf(page.request, customer.id)).length).toBe(before)
  })

  test('CM-F02: Add another opens Payment 2 — the same method buttons, its own Amount received prefilled with what is left; Remove takes it back', async ({
    page,
  }) => {
    const customer = await createInstallmentPlan(page, 'F02')
    await openFirstDue(page, customer.name)
    const net = await netDue(page)

    await fillMoney(amount(page, 0), '100')
    await addAnother(page).click()

    const second = page.getByTestId('collection-payment-1')
    await expect(second).toContainText('Payment 2')
    for (const name of ['Cash on Hand', 'Check', 'Bank Transfer', 'Debit/Credit Card']) {
      await expect(
        page.getByTestId('collection-method-1').getByRole('button', { name, exact: true })
      ).toBeVisible()
    }
    // Its amount sits under its own method, below Payment 1's.
    const y = async (id: string) => (await page.getByTestId(id).boundingBox())!.y
    expect(await y('collection-amount-0')).toBeLessThan(await y('collection-method-1'))
    expect(await y('collection-method-1')).toBeLessThan(await y('collection-amount-1'))

    // What is left of the due is already in it, and the strip follows.
    await expect(amount(page, 1)).toHaveValue(grouped(Math.round((net - 100) * 100) / 100))
    await expect(page.getByTestId('collection-paid-so-far')).toHaveText(/₱/)
    await expect(page.getByTestId('collection-remaining')).toHaveText('₱0.00')
    // One CR for the whole collection, however many payments.
    await expect(page.getByTestId('collection-cr-number')).toHaveCount(1)

    await page.getByTestId('collection-payment-remove-1').click()
    await expect(page.getByTestId('collection-payment-1')).toHaveCount(0)
    await expect(page.getByTestId('collection-payment-summary')).toHaveCount(0)
  })

  test('CM-F03: a due paid part cash, part card is recorded as two payments on two receipts — one CR on both — and settles the due', async ({
    page,
  }) => {
    const customer = await createInstallmentPlan(page, 'F03')
    await openFirstDue(page, customer.name)
    const net = await netDue(page)
    const cash = Math.floor(net / 3)
    const card = Math.round((net - cash) * 100) / 100
    const cr = `CR-CM-F03-${Date.now()}`

    await fillMoney(amount(page, 0), String(cash))
    await addAnother(page).click()
    // Opens on Debit/Credit Card (the first method nothing is using yet).
    await expect(
      page.getByTestId('collection-method-1').getByRole('button', {
        name: 'Debit/Credit Card',
        exact: true,
      })
    ).toHaveAttribute('aria-pressed', 'true')
    await fillMoney(amount(page, 1), String(card))
    await fillStable(page.getByTestId('collection-cr-number'), cr)

    await collect(page).click()
    await expect(page.getByRole('heading', { name: 'Collect Payment' })).not.toBeVisible({
      timeout: 20_000,
    })

    const payments = await paymentsOf(page.request, customer.id)
    // The down payment's own receipt aside, this collection's two payments.
    const mine = payments.filter((p) => p.reference === cr)
    expect(mine.map((p) => [p.method, Number(p.amount)])).toEqual([
      ['CASH', cash],
      ['CARD', card],
    ])
    // A receipt per method (a receipt has one), both on the one CR.
    expect(new Set(mine.map((p) => p.collectionReceiptId)).size).toBe(2)
  })

  test('CM-F04: a Bank Transfer payment needs the bank’s own reference, and it is listed against that payment', async ({
    page,
  }) => {
    const customer = await createInstallmentPlan(page, 'F04')
    await openFirstDue(page, customer.name)

    await fillMoney(amount(page, 0), '100')
    await addAnother(page).click()
    await page
      .getByTestId('collection-method-1')
      .getByRole('button', { name: 'Bank Transfer', exact: true })
      .click()
    await fillMoney(amount(page, 1), '50')
    await fillStable(page.getByTestId('collection-cr-number'), 'CR-CM-F04')

    await collect(page).click()
    await expect(page.getByTestId('collection-issues')).toContainText(
      'Payment 2 — Bank reference number'
    )
    await expect(page.getByTestId('collection-bank-reference-1')).toHaveClass(/border-red-400/)

    await fillStable(page.getByTestId('collection-bank-reference-1'), 'BANK-REF-F04')
    await expect(page.getByTestId('collection-issues')).toHaveCount(0)
  })

  test('CM-F05: a plan folds to its header like an accordion — its dues hide, a summary shows, and a ticked due stays selected', async ({
    page,
  }) => {
    const customer = await createInstallmentPlan(page, 'F05')
    await openFirstDue(page, customer.name)

    const toggle = page.locator('[data-testid^="plan-toggle-"]').first()
    const dues = page.locator('li').filter({ hasText: 'Payment 1 of' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(dues).toHaveCount(0)
    await expect(page.getByTestId('plan-summary')).toContainText('1 selected')
    // Only the view folded: the payment for the ticked due is still being taken.
    await expect(page.getByRole('heading', { name: 'Collect Payment' })).toBeVisible()

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(dues.first().getByRole('checkbox')).toBeChecked()
  })
})
