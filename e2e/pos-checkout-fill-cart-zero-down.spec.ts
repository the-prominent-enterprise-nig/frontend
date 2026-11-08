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
import { openNewApplication } from './credit-application-form'

// Nov UAT — four checkout/credit-application changes:
//
//   1. Credit application: the Customer Profile is always open — no toggle.
//   2. POS: an approved credit application on the customer card has a
//      "Fill cart" button that puts its approved items on the sale (installment,
//      application picked). A non-empty cart is only replaced once the cashier
//      agrees.
//   3. POS: an in-house plan may take ₱0 down for a business customer, or when
//      one of the plan's own lines has a price override. Anyone else is still
//      refused 0 (Oct 29 UAT POS-11).
//   4. "If 0%, no rebate" is server-side; see
//      backend/test/pos-zero-down-payment-and-rebate.e2e-spec.ts.
//
// The seed leaves nothing sellable that also has a price, so this spec builds
// its own two items on a Price Use + price list of its own, like the other
// checkout specs.

const PREFIX = 'E2E FillCartZeroDP'
const BRANCH = 'Bago'
const ITEM_PRICE = 12000
const OVERRIDE_PRICE = 11000

type Fixtures = {
  items: { id: string; name: string }[]
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

  const branches = ((await (await request.get('/api/branches?limit=200')).json()).data ?? []) as {
    id: string
    name: string
  }[]
  const branchId = branches.find((b) => b.name === BRANCH)!.id
  const warehouses = ((await (await request.get('/api/inventory/warehouses?limit=200')).json())
    .data ?? []) as { id: string; branchId: string | null }[]
  const warehouse = warehouses.find((w) => w.branchId === branchId)!

  const items: { id: string; name: string }[] = []
  for (const n of [1, 2]) {
    const name = `${PREFIX} Item ${n} ${stamp}`
    const itemRes = await request.post('/api/inventory/items', {
      data: {
        sku: `E2E-FCZ-${n}-${stamp}`,
        name,
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
    items.push({ id: item.id, name })
  }

  const adjustRes = await request.post('/api/inventory/adjustments', {
    data: {
      warehouseId: warehouse.id,
      adjustmentDate: new Date().toISOString().slice(0, 10),
      reasonCode: 'found',
      notes: 'E2E fill-cart / zero-DP fixture stock',
      lines: items.map((i) => ({ itemId: i.id, expectedQty: 0, actualQty: 50 })),
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
    data: { items: items.map((i) => ({ itemId: i.id, price: ITEM_PRICE })) },
  })
  expect(itemsRes.ok(), await itemsRes.text()).toBeTruthy()
  const approveRes = await request.post(`/api/inventory/price-lists/${priceList.id}/approve`, {
    data: {},
  })
  expect(approveRes.ok(), await approveRes.text()).toBeTruthy()

  return {
    items,
    priceUseTypeName,
    priceUseTypeId: priceUseType.id,
    priceListId: priceList.id,
    branchId,
  }
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

/** A customer with an application approved for the first fixture item. */
async function approvedApplicant(
  request: APIRequestContext,
  customerType: 'individual' | 'business' = 'individual'
): Promise<{ customer: { id: string; name: string }; applicationNumber: string }> {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const name = `${PREFIX} ${customerType} ${stamp}`
  const customerRes = await request.post('/api/crm/customers', {
    data: {
      name,
      customerType,
      phone: `0917${stamp.slice(-7)}`,
      coMakers: [
        { name: `${PREFIX} Co-Maker`, relationship: 'Sibling', contactNumber: '09171112222' },
      ],
    },
  })
  expect(customerRes.ok(), await customerRes.text()).toBeTruthy()
  const customer = await customerRes.json()
  createdCustomerIds.push(customer.id)

  const appRes = await request.post('/api/credit/applications', {
    data: {
      branchId: fx.branchId,
      applicantCustomerId: customer.id,
      coMakerId: customer.coMakers[0].id,
      priceUseTypeId: fx.priceUseTypeId,
      items: [{ itemId: fx.items[0].id }],
    },
  })
  expect(appRes.ok(), await appRes.text()).toBeTruthy()
  const application = await appRes.json()

  const upload = await request.post('/api/files/upload', {
    multipart: { file: { name: 'id.txt', mimeType: 'text/plain', buffer: Buffer.from('fake id') } },
  })
  const file = await upload.json()
  const doc = await request.post(`/api/credit/applications/${application.id}/documents`, {
    data: { fileId: file.id, documentType: 'applicant_id' },
  })
  expect(doc.ok(), await doc.text()).toBeTruthy()
  const submitted = await request.patch(`/api/credit/applications/${application.id}/submit`)
  expect(submitted.ok(), await submitted.text()).toBeTruthy()

  // Submitting approves it on some configurations (UAT §9 CA-01); otherwise it
  // goes through investigation and a decision.
  const status = (await (await request.get(`/api/credit/applications/${application.id}`)).json())
    .status as string
  if (status !== 'approved' && status !== 'partially_approved') {
    await request.post(`/api/credit/applications/${application.id}/investigation/start`)
    await request.post(`/api/credit/applications/${application.id}/investigation`, {
      data: { affordabilityOutcome: 'recommend_approve', notes: 'E2E' },
    })
    const decided = await request.patch(`/api/credit/applications/${application.id}/decide`, {
      data: {
        approveItemIds: (application.items as { id: string }[]).map((i) => i.id),
        declineItemIds: [],
      },
    })
    expect(decided.ok(), await decided.text()).toBeTruthy()
  }

  return {
    customer: { id: customer.id, name },
    applicationNumber: application.applicationNumber as string,
  }
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

async function addItem(page: Page, index: number): Promise<void> {
  const search = page.getByPlaceholder('Search by name or serial')
  await search.fill(fx.items[index].name)
  const card = page
    .getByRole('button')
    .filter({ has: page.getByText(fx.items[index].name, { exact: true }) })
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

const cartRow = (page: Page, index: number) => page.locator('tr', { hasText: fx.items[index].name })
const fillButton = (page: Page) => page.getByTestId('fill-cart-from-application')
const dpInput = (page: Page) => page.getByTestId('down-payment-input')
const dpError = (page: Page) => page.getByTestId('down-payment-error')
const exceptionSection = (page: Page) => page.getByTestId('price-override-exception')

/** Fill cart from the (only) application on the customer card, then wait for
 * the till to have put the item on as installment with the application
 * picked. */
async function fillCart(page: Page, applicationNumber: string): Promise<void> {
  await expect(fillButton(page)).toBeVisible({ timeout: 15_000 })
  await fillButton(page).click()
  await expect(cartRow(page, 0)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('combobox', { name: new RegExp(applicationNumber) })).toBeVisible({
    timeout: 20_000,
  })
}

async function pickFirstTerm(page: Page): Promise<void> {
  const termSelect = page.getByRole('combobox', { name: 'Select a term…' })
  if (await termSelect.isVisible().catch(() => false)) {
    await openCustomSelect(termSelect)
    await page
      .getByRole('option', { name: /months/ })
      .first()
      .click()
  }
  await expect(dpInput(page)).toBeVisible({ timeout: 10_000 })
}

async function applyOverride(page: Page, index: number, price: number): Promise<void> {
  await cartRow(page, index).getByRole('button', { name: 'Override price' }).click()
  await expect(page.getByRole('heading', { name: 'Price Override' })).toBeVisible()
  await page.getByLabel('New unit price').fill(String(price))
  await page.getByRole('button', { name: 'Apply Override' }).click()
  await expect(page.getByRole('heading', { name: 'Price Override' })).toHaveCount(0)
}

async function postedSale(page: Page, salesInvoiceNumber: string) {
  const listRes = await page.request.get('/api/pos/transactions', {
    params: { search: salesInvoiceNumber },
  })
  const listBody = await listRes.json()
  const sale = (
    (listBody.data ?? listBody) as { id: string; salesInvoiceNumber: string | null }[]
  ).find((t) => t.salesInvoiceNumber === salesInvoiceNumber)!
  return (await page.request.get(`/api/pos/transactions/${sale.id}`)).json()
}

test.describe('Nov UAT — Fill cart from an application, ₱0 down, Customer Profile', () => {
  test.describe.configure({ timeout: 150_000 })

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
      for (const item of fx.items) {
        await request.delete(`/api/inventory/items/${item.id}`).catch(() => {})
      }
    }
    await request.dispose()
  })

  // ── Credit application: Customer Profile ────────────────────────────────

  test('CP-01: the Customer Profile is always open — a plain header, its fields shown with no click', async ({
    page,
  }) => {
    const { customer } = await approvedApplicant(page.request)
    await openNewApplication(page, customer.name)

    const header = page.getByTestId('customer-profile-header')
    await expect(header).toBeVisible({ timeout: 15_000 })
    await expect(header).toContainText('Customer Profile')
    // Not a toggle any more: no button, nothing to expand.
    await expect(page.getByRole('button', { name: /Customer Profile/ })).toHaveCount(0)
    await expect(header).not.toHaveAttribute('aria-expanded')
    // The fields are there straight away.
    await expect(page.locator('label', { hasText: /^Birthdate/ })).toBeVisible()
    await expect(
      page.getByText("Changes save back to the customer's record, not to this application.")
    ).toBeVisible()
    // Clicking the header changes nothing.
    await header.click()
    await expect(page.locator('label', { hasText: /^Birthdate/ })).toBeVisible()
  })

  // ── POS: Fill cart ───────────────────────────────────────────────────────

  test('FC-01: on an empty cart, "Fill cart" puts the approved item on as installment with the application picked', async ({
    page,
  }) => {
    const { customer, applicationNumber } = await approvedApplicant(page.request)
    await openCheckout(page)
    await selectCustomer(page, customer.name)
    await expect(page.getByText('Subtotal (0 items)')).toBeVisible()

    await fillCart(page, applicationNumber)

    await expect(page.locator('tr', { hasText: PREFIX })).toHaveCount(1)
    await expect(
      page.getByRole('combobox', { name: 'Select a term…' }).or(dpInput(page))
    ).toBeVisible()
    // The application is now the sale's: its own Fill cart button is gone.
    await expect(fillButton(page)).toHaveCount(0)
  })

  test('FC-02 (edge): with something else in the cart, dismissing the confirm leaves the cart as it was; accepting replaces it', async ({
    page,
  }) => {
    const { customer, applicationNumber } = await approvedApplicant(page.request)
    await openCheckout(page)
    await addItem(page, 1)
    await expect(cartRow(page, 1)).toBeVisible()
    await selectCustomer(page, customer.name)

    page.once('dialog', (d) => {
      expect(d.message()).toContain(applicationNumber)
      void d.dismiss()
    })
    await fillButton(page).click()
    await expect(cartRow(page, 1)).toBeVisible()
    await expect(cartRow(page, 0)).toHaveCount(0)

    page.once('dialog', (d) => void d.accept())
    await fillCart(page, applicationNumber)
    await expect(cartRow(page, 1)).toHaveCount(0)
    await expect(page.locator('tr', { hasText: PREFIX })).toHaveCount(1)
  })

  test('FC-03 (hard edge): emptying the cart and filling again rebuilds it — once, not twice', async ({
    page,
  }) => {
    const { customer, applicationNumber } = await approvedApplicant(page.request)
    await openCheckout(page)
    await selectCustomer(page, customer.name)
    await fillCart(page, applicationNumber)

    await cartRow(page, 0).getByRole('button', { name: 'Remove item' }).click()
    await expect(cartRow(page, 0)).toHaveCount(0)

    // The application is no longer the sale's, so it can be filled again.
    await fillCart(page, applicationNumber)
    await expect(page.locator('tr', { hasText: PREFIX })).toHaveCount(1)
  })

  test('FC-04: a customer without an application has no Fill cart button', async ({ page }) => {
    const name = `${PREFIX} NoApp ${Date.now()}`
    const res = await page.request.post('/api/crm/customers', {
      data: { name, customerType: 'individual', phone: `0917${Date.now().toString().slice(-7)}` },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    createdCustomerIds.push((await res.json()).id)

    await openCheckout(page)
    await selectCustomer(page, name)
    await expect(page.getByTestId('customer-credit-applications')).toContainText(
      'No approved credit application on file.'
    )
    await expect(fillButton(page)).toHaveCount(0)
  })

  // ── POS: ₱0 down payment ─────────────────────────────────────────────────

  test('ZD-01 (regression): an individual with no override is still refused ₱0 down', async ({
    page,
  }) => {
    const { customer, applicationNumber } = await approvedApplicant(page.request)
    await openCheckout(page)
    await selectCustomer(page, customer.name)
    await fillCart(page, applicationNumber)
    await pickFirstTerm(page)

    await fillStable(dpInput(page), '0')
    await expect(dpError(page)).toContainText('not 0')
  })

  test('ZD-02: a business customer takes ₱0 down — no error, and the plan posts with nothing down', async ({
    page,
  }) => {
    const { customer, applicationNumber } = await approvedApplicant(page.request, 'business')
    const salesInvoiceNumber = `SI-FCZ-ZD02-${Date.now()}`
    await openCheckout(page)
    await selectCustomer(page, customer.name)
    await fillCart(page, applicationNumber)
    await pickFirstTerm(page)

    await fillStable(dpInput(page), '0')
    await dpInput(page).blur()
    await expect(dpError(page)).toHaveCount(0)

    await fillStable(page.getByLabel('Sales Invoice No.'), salesInvoiceNumber)
    // Not clickStable — this submits a real sale.
    await page.getByRole('button', { name: /Create Installment Plan/ }).click()
    await expect(page.getByText('Installment Plan Created', { exact: true })).toBeVisible({
      timeout: 25_000,
    })

    const detail = await postedSale(page, salesInvoiceNumber)
    expect(Number(detail.lines[0].downPayment)).toBe(0)
  })

  test('ZD-03: an individual takes ₱0 down once the financed line’s price is overridden, and it posts', async ({
    page,
  }) => {
    const { customer, applicationNumber } = await approvedApplicant(page.request)
    const salesInvoiceNumber = `SI-FCZ-ZD03-${Date.now()}`
    await openCheckout(page)
    await selectCustomer(page, customer.name)
    await fillCart(page, applicationNumber)
    await applyOverride(page, 0, OVERRIDE_PRICE)
    await pickFirstTerm(page)

    await fillStable(dpInput(page), '0')
    await dpInput(page).blur()
    await expect(dpError(page)).toHaveCount(0)

    const section = exceptionSection(page)
    await openCustomSelect(section.getByRole('combobox', { name: 'Pick a reason…' }))
    await page.getByRole('listbox').getByRole('option', { name: 'Management special' }).click()
    await fillStable(section.getByRole('textbox').last(), 'Negotiated, nothing down')

    await fillStable(page.getByLabel('Sales Invoice No.'), salesInvoiceNumber)
    await page.getByRole('button', { name: /Create Installment Plan/ }).click()
    await expect(page.getByText('Installment Plan Created', { exact: true })).toBeVisible({
      timeout: 25_000,
    })

    const detail = await postedSale(page, salesInvoiceNumber)
    expect(Number(detail.lines[0].downPayment)).toBe(0)
    expect(detail.lines[0].priceOverrideBy).toBeTruthy()
  })

  test('ZD-04 (hard edge): clearing the override takes the ₱0 allowance away again', async ({
    page,
  }) => {
    const { customer, applicationNumber } = await approvedApplicant(page.request)
    await openCheckout(page)
    await selectCustomer(page, customer.name)
    await fillCart(page, applicationNumber)
    await applyOverride(page, 0, OVERRIDE_PRICE)
    await pickFirstTerm(page)

    await fillStable(dpInput(page), '0')
    await dpInput(page).blur()
    await expect(dpError(page)).toHaveCount(0)

    await cartRow(page, 0).getByRole('button', { name: 'Clear override' }).click()
    await expect(exceptionSection(page)).toHaveCount(0)

    // The box's own check re-runs on the next edit; submitting is refused too.
    await fillStable(dpInput(page), '0')
    await expect(dpError(page)).toContainText('not 0')
  })
})
