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
} from './utils'

// Scenario 66 — delivery at POS checkout: Deliver to, Delivery Address and a
// delivery fee collected on its own collection receipt, never part of the
// sale. The money side (the fee's receipt and JE, the CR rules, reports) is
// covered by backend/test/pos-delivery-fee-checkout.e2e-spec.ts and
// pos-delivery-fee-reports.e2e-spec.ts; this spec covers the checkout UI that
// drives it. Case IDs (DF-F…) match docs/scenario-66-pos-delivery-fee-plan.md.
//
// Checkout posts through Next server actions, so a browser request listener
// never sees the backend call — "nothing was posted" is checked through the
// API instead, by the sale's Sales Invoice No.
//
// Fixtures follow pos-checkout-x-deal (Scenario 65): a fresh non-serial item,
// stocked at Bago, priced on a Price Use + price list of its own.

const PREFIX = 'E2E Delivery'
const BRANCH = 'Bago'
const ITEM_PRICE = 8000
const ADDRESS =
  '12 Rizal St., Abuanan, Bago City, Negros Occidental, Region VI (Western Visayas), Philippines'
const BARANGAY_CODE = '064502001'

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
/** What DELIVERY_FEE_INCOME pointed at before this spec, to put back. */
let mappingBefore: string | null | undefined

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
      sku: `E2E-DELIVERY-${stamp}`,
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
      notes: 'E2E delivery fixture stock',
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

/** DELIVERY_FEE_INCOME → 4-02-030, as the seed and the Scenario 66 backfill do. */
async function mapDeliveryIncome(request: APIRequestContext): Promise<void> {
  const mappings = (await (await request.get('/api/account-mapping')).json()) as
    | { key: string; accountId: string | null }[]
    | { data: { key: string; accountId: string | null }[] }
  const list = Array.isArray(mappings) ? mappings : mappings.data
  mappingBefore = list.find((m) => m.key === 'DELIVERY_FEE_INCOME')?.accountId ?? null

  const accountsBody = await (await request.get('/api/accounts?search=4-02-030')).json()
  const accounts = (Array.isArray(accountsBody) ? accountsBody : accountsBody.data) as {
    id: string
    number: string
  }[]
  const deliveryIncome = accounts.find((a) => a.number === '4-02-030')!
  const res = await request.patch('/api/account-mapping/DELIVERY_FEE_INCOME', {
    data: { accountId: deliveryIncome.id },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
}

async function createCustomer(
  request: APIRequestContext,
  label: string,
  extra: Record<string, unknown> = {}
): Promise<{ id: string; name: string }> {
  const name = `${PREFIX} ${label} ${Date.now()}`
  const res = await request.post('/api/crm/customers', {
    data: {
      name,
      customerType: 'individual',
      phone: `0917${Date.now().toString().slice(-7)}`,
      ...extra,
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const customer = await res.json()
  createdCustomerIds.push(customer.id)
  return { id: customer.id, name }
}

const withAddress = { address: ADDRESS, barangayCode: BARANGAY_CODE }

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

async function openCheckout(page: Page): Promise<void> {
  await gotoReady(page, '/pos/checkout')
  await pickSessionIfAsked(page)
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
  await page.getByLabel('Price Use').first().selectOption({ label: fx.priceUseTypeName })
}

async function selectCustomer(page: Page, name: string): Promise<void> {
  const input = page.getByPlaceholder('Search by name or phone…')
  await input.click()
  await fillStable(input, name)
  await page.getByRole('button', { name: new RegExp(name) }).click()
}

/** The selected customer's card ends in an icon-only ✕ (no accessible name on
 * this base), so it is found as the X-icon button in the card holding the name. */
async function clearSelectedCustomer(page: Page, name: string): Promise<void> {
  await page
    .getByText(name, { exact: true })
    .first()
    .locator(
      "xpath=ancestor::div[.//button[.//*[contains(@class,'lucide-x')]]][1]//button[.//*[contains(@class,'lucide-x')]]"
    )
    .first()
    .click()
  await expect(page.getByPlaceholder('Search by name or phone…')).toBeVisible()
}

/** A cash sale ready to confirm: cart, customer, Sales Invoice No., payment. */
async function readyCashSale(page: Page, customerName: string, salesInvoiceNumber: string) {
  await openCheckout(page)
  await addItem(page)
  await selectCustomer(page, customerName)
  await fillStable(page.getByLabel('Sales Invoice No.'), salesInvoiceNumber)
}

async function fillPayment(page: Page, cr: string): Promise<void> {
  await fillStable(page.getByLabel('Amount received'), '100000')
  await fillStable(page.getByPlaceholder('CR Number *'), cr)
}

const section = (page: Page) => page.getByTestId('delivery-section')
const toggle = (page: Page) => page.getByTestId('delivery-toggle')
const deliverTo = (page: Page) => page.getByLabel('Deliver to')
const feeInput = (page: Page) => page.getByLabel('Delivery fee', { exact: true })
const feeCr = (page: Page) => page.getByLabel('Delivery fee CR No.')
const confirm = (page: Page) => page.getByRole('button', { name: 'Confirm Sale' })

async function salesBySalesInvoice(request: APIRequestContext, salesInvoiceNumber: string) {
  const res = await request.get('/api/pos/transactions', {
    params: { search: salesInvoiceNumber },
  })
  const body = await res.json()
  return ((body.data ?? body) as { id: string; salesInvoiceNumber: string | null }[]).filter(
    (t) => t.salesInvoiceNumber === salesInvoiceNumber
  )
}

test.describe('POS Checkout — Delivery (Scenario 66)', () => {
  test.beforeAll(async ({ playwright }, testInfo) => {
    const request = await ownerRequest(playwright, testInfo.project.use.baseURL!)
    await sweepE2ECustomers(request, PREFIX)
    await sweepE2EPriceLists(request, PREFIX)
    await sweepE2EPriceUseTypes(request, PREFIX)
    fx = await createFixtures(request)
    await ensureOpenSession(request, fx.branchId)
    await mapDeliveryIncome(request)
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
    if (mappingBefore !== undefined) {
      await request
        .patch('/api/account-mapping/DELIVERY_FEE_INCOME', { data: { accountId: mappingBefore } })
        .catch(() => {})
    }
    await request.dispose()
  })

  test('DF-F01: For delivery pre-fills Deliver to and the address from the customer; the tender and CR wait for a fee', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'F01', withAddress)
    await openCheckout(page)
    await addItem(page)
    await selectCustomer(page, customer.name)

    await expect(deliverTo(page)).toHaveCount(0)
    await toggle(page).check()

    await expect(deliverTo(page)).toHaveValue(customer.name)
    await expect(page.getByTestId('delivery-customer-address')).toContainText(ADDRESS, {
      timeout: 15_000,
    })
    await expect(feeInput(page)).toHaveValue('')
    await expect(feeCr(page)).toHaveCount(0)
    await expect(page.getByTestId('delivery-fee-method')).toHaveCount(0)
    await expect(section(page)).toContainText('Free delivery — no fee to collect.')
  })

  test('DF-F02: typing a fee leaves both Totals alone and shows the fee beside them', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'F02', withAddress)
    await openCheckout(page)
    await addItem(page)
    await selectCustomer(page, customer.name)
    const totalBefore = await page.getByTestId('order-summary-total').textContent()

    await toggle(page).check()
    await fillStable(feeInput(page), '150')

    await expect(page.getByTestId('order-summary-total')).toHaveText(totalBefore!)
    await expect(page.getByTestId('order-summary-delivery-fee')).toContainText('₱150.00')
    await expect(page.getByTestId('payment-delivery-fee')).toContainText('₱150.00')
    await expect(feeCr(page)).toBeVisible()
    await expect(page.getByTestId('delivery-fee-method')).toBeVisible()
  })

  test('DF-F03: Confirm is blocked for a blank Deliver to, and for a fee with no CR — nothing is posted', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'F03', withAddress)
    const salesInvoiceNumber = `SI-DFF03-${Date.now()}`
    await readyCashSale(page, customer.name, salesInvoiceNumber)
    await toggle(page).check()
    await fillPayment(page, `CR-DFF03-SALE-${Date.now()}`)

    await deliverTo(page).fill('   ')
    await confirm(page).click()
    await expect(page.getByText('Enter who receives the delivery (Deliver to).')).toBeVisible()

    await fillStable(deliverTo(page), 'Maria Santos')
    await fillStable(feeInput(page), '150')
    await confirm(page).click()
    await expect(
      page.getByText('Enter the collection receipt (CR) number for the delivery fee.')
    ).toBeVisible()

    expect(await salesBySalesInvoice(page.request, salesInvoiceNumber)).toHaveLength(0)
  })

  test("DF-F04: the fee's CR can't be the payment's CR", async ({ page }) => {
    const customer = await createCustomer(page.request, 'F04', withAddress)
    const salesInvoiceNumber = `SI-DFF04-${Date.now()}`
    const cr = `CR-DFF04-${Date.now()}`
    await readyCashSale(page, customer.name, salesInvoiceNumber)
    await toggle(page).check()
    await fillStable(feeInput(page), '150')
    await fillStable(feeCr(page), ` ${cr.toLowerCase()} `)
    await fillPayment(page, cr)

    await confirm(page).click()
    await expect(
      page.getByText(
        "The delivery fee needs its own CR number — it can't be the same as the payment's."
      )
    ).toBeVisible()
    expect(await salesBySalesInvoice(page.request, salesInvoiceNumber)).toHaveLength(0)
  })

  test('DF-F05 / DF-F15: a sale with a fee posts it on its own receipt — the success screen and the transaction detail show the delivery apart from the total', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'F05', withAddress)
    const salesInvoiceNumber = `SI-DFF05-${Date.now()}`
    const feeCrNumber = `CR-DFF05-FEE-${Date.now()}`
    await readyCashSale(page, customer.name, salesInvoiceNumber)

    await toggle(page).check()
    await expect(page.getByTestId('delivery-customer-address')).toBeVisible({ timeout: 15_000 })
    await fillStable(feeInput(page), '150')
    await fillStable(feeCr(page), feeCrNumber)
    await fillPayment(page, `CR-DFF05-SALE-${Date.now()}`)

    // Not clickStable — this submits a real sale.
    await confirm(page).click()
    await expect(page.getByText('Sale Complete', { exact: true })).toBeVisible({
      timeout: 20_000,
    })
    const success = page.getByTestId('success-delivery')
    await expect(success).toContainText(customer.name)
    await expect(success).toContainText(ADDRESS)
    await expect(success).toContainText('₱150.00')
    await expect(success).toContainText(feeCrNumber)

    // The sale itself: delivery stored, total untouched, fee on its own receipt.
    const [sale] = await salesBySalesInvoice(page.request, salesInvoiceNumber)
    expect(sale).toBeTruthy()
    const detail = await (await page.request.get(`/api/pos/transactions/${sale.id}`)).json()
    const tx = detail.data ?? detail
    expect(tx.deliverTo).toBe(customer.name)
    expect(tx.deliveryAddress).toBe(ADDRESS)
    expect(tx.deliveryBarangayCode).toBe(BARANGAY_CODE)
    expect(Number(tx.deliveryFee)).toBe(150)
    expect(tx.deliveryFeeCollectionReceipt).toMatchObject({
      reference: feeCrNumber,
      method: 'CASH',
      amount: 150,
    })

    // DF-F15 — the transaction detail.
    await gotoReady(page, '/pos/transactions')
    const row = page.locator('tr', { hasText: salesInvoiceNumber })
    await expect(async () => {
      await fillStable(page.getByPlaceholder('Search…'), salesInvoiceNumber)
      await expect(row).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 45_000 })
    await row.click()
    const block = page.getByTestId('transaction-delivery')
    await expect(block).toBeVisible({ timeout: 10_000 })
    await expect(block).toContainText(customer.name)
    await expect(block).toContainText('₱150.00')
    await expect(block).toContainText(feeCrNumber)
  })

  test('DF-F06: a free delivery asks for no CR and shows as free', async ({ page }) => {
    const customer = await createCustomer(page.request, 'F06', withAddress)
    await readyCashSale(page, customer.name, `SI-DFF06-${Date.now()}`)
    await toggle(page).check()
    await expect(page.getByTestId('delivery-customer-address')).toBeVisible({ timeout: 15_000 })
    await fillPayment(page, `CR-DFF06-SALE-${Date.now()}`)

    await expect(feeCr(page)).toHaveCount(0)
    await confirm(page).click()
    await expect(page.getByText('Sale Complete', { exact: true })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByTestId('success-delivery')).toContainText('Free delivery')
  })

  test('DF-F07: an edited Deliver to survives a customer change; the address follows the new customer', async ({
    page,
  }) => {
    const first = await createCustomer(page.request, 'F07a', withAddress)
    const secondAddress =
      '5 Mabini St., Alianza, Bago City, Negros Occidental, Region VI (Western Visayas), Philippines'
    const second = await createCustomer(page.request, 'F07b', {
      address: secondAddress,
      barangayCode: '064502002',
    })
    await openCheckout(page)
    await addItem(page)
    await selectCustomer(page, first.name)
    await toggle(page).check()
    await fillStable(deliverTo(page), 'Lola Remedios')

    await clearSelectedCustomer(page, first.name)
    await selectCustomer(page, second.name)

    await expect(deliverTo(page)).toHaveValue('Lola Remedios')
    await expect(page.getByTestId('delivery-customer-address')).toContainText(secondAddress, {
      timeout: 15_000,
    })
  })

  test('DF-F08: turning delivery off clears it and the sale carries none', async ({ page }) => {
    const customer = await createCustomer(page.request, 'F08', withAddress)
    const salesInvoiceNumber = `SI-DFF08-${Date.now()}`
    await readyCashSale(page, customer.name, salesInvoiceNumber)
    await toggle(page).check()
    await fillStable(feeInput(page), '150')
    await toggle(page).uncheck()

    await expect(deliverTo(page)).toHaveCount(0)
    await expect(page.getByTestId('order-summary-delivery-fee')).toHaveCount(0)
    await toggle(page).check()
    await expect(feeInput(page)).toHaveValue('')
    await toggle(page).uncheck()

    await fillPayment(page, `CR-DFF08-SALE-${Date.now()}`)
    await confirm(page).click()
    await expect(page.getByText('Sale Complete', { exact: true })).toBeVisible({
      timeout: 20_000,
    })
    const [sale] = await salesBySalesInvoice(page.request, salesInvoiceNumber)
    const detail = await (await page.request.get(`/api/pos/transactions/${sale.id}`)).json()
    const tx = detail.data ?? detail
    expect(tx.deliverTo).toBeNull()
    expect(Number(tx.deliveryFee)).toBe(0)
    expect(tx.deliveryFeeCollectionReceipt).toBeNull()
  })

  test('DF-F16: an edited address must be saved — it then closes into a card the sale carries (PR #201 review)', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'F16', withAddress)
    const salesInvoiceNumber = `SI-DFF16-${Date.now()}`
    const edited = ADDRESS.replace('12 Rizal St.', 'Purok 1')
    await readyCashSale(page, customer.name, salesInvoiceNumber)
    await toggle(page).check()
    await page
      .getByTestId('delivery-customer-address')
      .getByRole('button', { name: 'Change address' })
      .click({ timeout: 15_000 })

    const picker = page.getByTestId('delivery-address-picker')
    const street = picker.getByPlaceholder('e.g. Blk 3 Lot 12, Mabuhay St.')
    await expect(picker).toContainText('Barangay selected: Abuanan', { timeout: 15_000 })
    await expect(street).toHaveValue('12 Rizal St.')
    await fillStable(street, 'Purok 1')
    await fillPayment(page, `CR-DFF16-SALE-${Date.now()}`)

    await confirm(page).click()
    await expect(page.getByText('Save the delivery address first.')).toBeVisible()
    expect(await salesBySalesInvoice(page.request, salesInvoiceNumber)).toHaveLength(0)

    await page.getByTestId('delivery-save-address').click()
    const saved = page.getByTestId('delivery-saved-address')
    await expect(saved).toContainText('Edited address saved')
    await expect(saved).toContainText(edited)
    await expect(picker).toHaveCount(0)

    // Reopening starts from the saved pick, not the customer's address.
    await saved.getByRole('button', { name: 'Change address' }).click()
    await expect(picker).toContainText('Barangay selected: Abuanan', { timeout: 15_000 })
    await expect(street).toHaveValue('Purok 1')
    await page.getByTestId('delivery-save-address').click()

    await confirm(page).click()
    await expect(page.getByText('Sale Complete', { exact: true })).toBeVisible({
      timeout: 20_000,
    })
    const [sale] = await salesBySalesInvoice(page.request, salesInvoiceNumber)
    const detail = await (await page.request.get(`/api/pos/transactions/${sale.id}`)).json()
    const tx = detail.data ?? detail
    expect(tx.deliveryAddress).toBe(edited)
    expect(tx.deliveryBarangayCode).toBe(BARANGAY_CODE)
  })

  test('DF-F12: delivery is unavailable offline', async ({ page }) => {
    const customer = await createCustomer(page.request, 'F12', withAddress)
    await openCheckout(page)
    await addItem(page)
    await selectCustomer(page, customer.name)

    await page.context().setOffline(true)
    try {
      await expect(toggle(page)).toBeDisabled()
      await expect(page.getByTestId('delivery-unavailable')).toContainText(
        'Delivery needs a connection'
      )
    } finally {
      await page.context().setOffline(false)
    }
    await expect(toggle(page)).toBeEnabled()
  })

  test('DF-F13: the TPF panel asks for no approved amount (Scenario 64 Part 2 regression)', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'F13', withAddress)
    await openCheckout(page)
    await addItem(page)
    await selectCustomer(page, customer.name)

    await page.getByRole('button', { name: 'Installment', exact: true }).click()
    await page.getByRole('button', { name: 'TPF Installment', exact: true }).first().click()
    await expect(page.getByText('TPF Provider *')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByPlaceholder(/Approved amount/)).toHaveCount(0)
  })
})
