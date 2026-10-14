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

// Scenario 71 Part 3 — waiving the credit application at checkout. The backend
// rules are covered by backend/test/pos-credit-application-waiver.e2e-spec.ts;
// this spec covers the checkbox and what it changes on screen (the picker goes,
// the reason section comes), a real waived sale read back through the API, and
// the credit warnings an in-house installment sale now shows after it posts.
// Case IDs (WV-F…) match docs/scenario-71-price-override-end-of-day-review-plan.md.

const PREFIX = 'E2E Waiver'
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
      sku: `E2E-PO71-${stamp}`,
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
      notes: 'E2E price override fixture stock',
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

async function ensureOpenSession(request: APIRequestContext, branchId: string): Promise<void> {
  const terminals = (await (
    await request.get('/api/pos/terminals', { params: { branchId } })
  ).json()) as { id: string; status: string }[]
  const terminal = terminals.find((t) => t.status === 'active') ?? terminals[0]
  const open = (await (
    await request.get('/api/pos/sessions', { params: { terminalId: terminal.id, status: 'open' } })
  ).json()) as { id: string }[]
  // Reused rather than closed: closing needs the declared cash to match the
  // expected amount, so a rerun would otherwise fail.
  if (open.length) return
  await request.post('/api/pos/sessions/open', {
    data: { terminalId: terminal.id, openingCash: 1000 },
  })
}

/** Business Owner sees every branch's open sessions and has to pick Bago's
 * when there are several; with only this spec's own session open, checkout
 * auto-selects it and shows no picker at all. */
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
  await pickCartPriceUse(page, fx.priceUseTypeName)
}

async function selectCustomer(page: Page, name: string): Promise<void> {
  const input = page.getByPlaceholder('Search by name or phone…')
  await input.click()
  await fillStable(input, name)
  await page.getByRole('button', { name: new RegExp(name) }).click()
}

const exceptionSection = (page: Page) => page.getByTestId('price-override-exception')

async function createApplicant(
  request: APIRequestContext,
  label: string,
  creditLimit?: number
): Promise<{ id: string; name: string }> {
  const stamp = Date.now()
  const name = `${PREFIX} ${label} ${stamp}`
  const res = await request.post('/api/crm/customers', {
    data: {
      name,
      customerType: 'individual',
      phone: `0917${stamp.toString().slice(-7)}`,
      ...(creditLimit !== undefined ? { creditLimit } : {}),
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const customer = await res.json()
  createdCustomerIds.push(customer.id)
  return { id: customer.id, name }
}

const waiverCheckbox = (page: Page) => page.getByTestId('credit-waiver-checkbox')
const applicationPicker = (page: Page) =>
  page.getByText('Approved Credit Application', { exact: true })

/** A fresh sale: the fixture item on an in-house installment line for the
 * given customer. */
async function startInstallmentSale(page: Page, customerName: string): Promise<void> {
  await openCheckout(page)
  await addItem(page)
  await selectCustomer(page, customerName)
  await page.getByRole('button', { name: 'Installment', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Select a term…' })).toBeVisible({
    timeout: 10_000,
  })
}

/** Waives, picks a term and a reason, and posts — the cash down payment goes
 * through the usual cash tender. Returns the sale's Sales Invoice number. */
async function postWaivedSale(page: Page, note: string): Promise<string> {
  const salesInvoiceNumber = `SI-WVF-${Date.now()}`
  await waiverCheckbox(page).check()
  await openCustomSelect(page.getByRole('combobox', { name: 'Select a term…' }))
  await page.getByRole('listbox').getByRole('option').first().click()

  const section = exceptionSection(page)
  await openCustomSelect(section.getByRole('combobox', { name: 'Pick a reason…' }))
  await page.getByRole('listbox').getByRole('option', { name: 'Management special' }).click()
  await fillStable(section.getByLabel('Note for the price override or typed terms'), note)

  await fillStable(page.getByLabel('Sales Invoice No.'), salesInvoiceNumber)
  await page
    .getByTestId('dp-payment-mode-toggle')
    .getByRole('button', { name: 'Cash', exact: true })
    .click()
  await fillStable(page.getByPlaceholder('0.00').first(), '100000')
  await fillStable(page.getByPlaceholder('CR Number'), `CR-WVF-${Date.now()}`)

  // Not clickStable — this submits a real sale.
  await page.getByRole('button', { name: /Create Installment Plan/ }).click()
  await expect(page.getByText('Installment Plan Created', { exact: true })).toBeVisible({
    timeout: 45_000,
  })
  return salesInvoiceNumber
}

async function readSale(page: Page, customerId: string, salesInvoiceNumber: string) {
  const listRes = await page.request.get('/api/pos/transactions', {
    params: { customerId },
  })
  const body = await listRes.json()
  const sale = ((body.data ?? body) as { id: string; salesInvoiceNumber: string | null }[]).find(
    (t) => t.salesInvoiceNumber === salesInvoiceNumber
  )!
  return (await page.request.get(`/api/pos/transactions/${sale.id}`)).json()
}

test.describe('POS Checkout — waiving the credit application (Scenario 71 Part 3)', () => {
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

  test('WV-F01: the waiver is offered once there is a customer and an in-house installment line, and not before', async ({
    page,
  }) => {
    const customer = await createApplicant(page.request, 'F01')
    await openCheckout(page)
    await addItem(page)
    await expect(waiverCheckbox(page)).toHaveCount(0)

    await selectCustomer(page, customer.name)
    // A cash line has no credit application to waive.
    await expect(waiverCheckbox(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'Installment', exact: true }).click()
    await expect(waiverCheckbox(page)).toBeVisible({ timeout: 10_000 })
    await expect(waiverCheckbox(page)).not.toBeChecked()
  })

  test('WV-F02: ticking it replaces the credit-application picker and asks for a reason; Confirm is refused until one is given', async ({
    page,
  }) => {
    const customer = await createApplicant(page.request, 'F02')
    await startInstallmentSale(page, customer.name)
    await expect(applicationPicker(page)).toBeVisible()
    await expect(exceptionSection(page)).toHaveCount(0)

    await waiverCheckbox(page).check()

    await expect(applicationPicker(page)).toHaveCount(0)
    await expect(
      page.getByText('Credit application waived — flagged for management review.')
    ).toBeVisible()
    const section = exceptionSection(page)
    await expect(section).toBeVisible()
    await expect(section).toContainText('Credit Application Waived')

    // Pick a term so the sale is otherwise complete, then try to confirm.
    await openCustomSelect(page.getByRole('combobox', { name: 'Select a term…' }))
    await page.getByRole('listbox').getByRole('option').first().click()
    await fillStable(page.getByLabel('Sales Invoice No.'), `SI-WVF02-${Date.now()}`)
    await page
      .getByTestId('dp-payment-mode-toggle')
      .getByRole('button', { name: 'Cash', exact: true })
      .click()
    await fillStable(page.getByPlaceholder('0.00').first(), '100000')
    await fillStable(page.getByPlaceholder('CR Number'), `CR-WVF02-${Date.now()}`)
    await page.getByRole('button', { name: /Create Installment Plan/ }).click()
    await expect(page.getByText('Pick a reason for the credit application waiver.')).toBeVisible()
    await expect(page.getByText('Installment Plan Created', { exact: true })).toHaveCount(0)
  })

  test('WV-F03: unticking brings the picker back and takes the reason section away', async ({
    page,
  }) => {
    const customer = await createApplicant(page.request, 'F03')
    await startInstallmentSale(page, customer.name)
    await waiverCheckbox(page).check()
    await expect(exceptionSection(page)).toBeVisible()

    await waiverCheckbox(page).uncheck()

    await expect(applicationPicker(page)).toBeVisible()
    await expect(exceptionSection(page)).toHaveCount(0)
  })

  test('WV-F04: changing the customer drops the waiver', async ({ page }) => {
    const first = await createApplicant(page.request, 'F04a')
    const second = await createApplicant(page.request, 'F04b')
    await startInstallmentSale(page, first.name)
    await waiverCheckbox(page).check()

    await page.getByRole('button', { name: 'Clear customer' }).click()
    await selectCustomer(page, second.name)
    await page.getByRole('button', { name: 'Installment', exact: true }).click()

    await expect(waiverCheckbox(page)).toBeVisible({ timeout: 10_000 })
    await expect(waiverCheckbox(page)).not.toBeChecked()
    await expect(exceptionSection(page)).toHaveCount(0)
  })

  test('WV-F05: a waived sale posts at once, with no application, and keeps the waiver, reason and note', async ({
    page,
  }) => {
    const customer = await createApplicant(page.request, 'F05')
    await startInstallmentSale(page, customer.name)

    const salesInvoiceNumber = await postWaivedSale(page, 'Kilala ni Boss')
    // Posted, not sent for approval.
    await expect(page.getByText('Sent for approval')).toHaveCount(0)

    const detail = await readSale(page, customer.id, salesInvoiceNumber)
    expect(detail.creditApplicationWaived).toBe(true)
    expect(detail.exceptionNote).toBe('Kilala ni Boss')
    expect(detail.exceptionReasonId).toBeTruthy()
    expect(detail.status).toBe('completed')
  })

  test('WV-F06: when the credit check has something to say, the success screen shows it', async ({
    page,
  }) => {
    // A ₱1,000 limit against a ₱12,000 sale.
    const customer = await createApplicant(page.request, 'F06', 1000)
    await startInstallmentSale(page, customer.name)

    await postWaivedSale(page, 'Over the limit on purpose')

    const warnings = page.getByTestId('success-credit-warnings')
    await expect(warnings).toBeVisible()
    await expect(warnings).toContainText(/limit/i)
    await expect(warnings).toContainText('end-of-day review')
  })

  test('WV-F07: a sale with nothing to warn about shows no warning', async ({ page }) => {
    const customer = await createApplicant(page.request, 'F07', 10_000_000)
    await startInstallmentSale(page, customer.name)
    await postWaivedSale(page, 'Plenty of limit')
    await expect(page.getByTestId('success-credit-warnings')).toHaveCount(0)
  })
})
