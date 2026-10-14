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

// Scenario 71 Part 2 — typing an in-house installment plan at checkout: months,
// down payment, monthly installment and the first due date (FMI), with no
// Financing Term, rate card or 10% floor behind it. The backend rules and the
// posted schedule are covered by backend/test/pos-typed-installment-plan
// .e2e-spec.ts; this spec covers the panel that drives them, the preset, the
// reason section it brings in, and one real sale read back through the API.
// Case IDs (PO2-F…) match docs/scenario-71-price-override-end-of-day-review-plan.md.
//
// The seed leaves nothing sellable that also has a price, so this spec builds
// its own item, Price Use and price list (see createFixtures), as the other
// checkout specs do.

const PREFIX = 'E2E TypedPlan'
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

/** draft → submit → investigate → decide, through the app's own API as the
 * Business Owner, scoped to the fixture item and priced under its Price Use. */
async function createApprovedApplication(
  request: APIRequestContext,
  branchId: string
): Promise<{ customer: { id: string; name: string }; applicationNumber: string }> {
  const stamp = Date.now()
  const name = `${PREFIX} Applicant ${stamp}`
  const customerRes = await request.post('/api/crm/customers', {
    data: {
      name,
      customerType: 'individual',
      phone: `0917${stamp.toString().slice(-7)}`,
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
      branchId,
      applicantCustomerId: customer.id,
      coMakerId: customer.coMakers[0].id,
      priceUseTypeId: fx.priceUseTypeId,
      items: [{ itemId: fx.itemId }],
    },
  })
  expect(appRes.ok(), await appRes.text()).toBeTruthy()
  const application = await appRes.json()

  const uploadRes = await request.post('/api/files/upload', {
    multipart: {
      file: { name: 'id.txt', mimeType: 'text/plain', buffer: Buffer.from('fake id') },
    },
  })
  const file = await uploadRes.json()
  const steps: [string, string, object?][] = [
    [
      'post',
      `/api/credit/applications/${application.id}/documents`,
      { fileId: file.id, documentType: 'applicant_id' },
    ],
    ['patch', `/api/credit/applications/${application.id}/submit`],
    ['post', `/api/credit/applications/${application.id}/investigation/start`],
    [
      'post',
      `/api/credit/applications/${application.id}/investigation`,
      { affordabilityOutcome: 'recommend_approve', notes: 'E2E' },
    ],
    [
      'patch',
      `/api/credit/applications/${application.id}/decide`,
      {
        approveItemIds: (application.items as { id: string }[]).map((i) => i.id),
        declineItemIds: [],
      },
    ],
  ]
  for (const [method, url, data] of steps) {
    const res = await (method === 'post'
      ? request.post(url, { data })
      : request.patch(url, { data }))
    expect(res.ok(), `${method} ${url}: ${await res.text()}`).toBeTruthy()
  }
  return {
    customer: { id: customer.id, name },
    applicationNumber: application.applicationNumber as string,
  }
}

const typedPlan = (page: Page) => page.getByTestId('typed-plan')
const todayPlus = (days: number, months = 0): string => {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setMonth(d.getMonth() + months)
  d.setDate(d.getDate() + days)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Opens checkout with the fixture item on an in-house installment line, the
 * applicant selected and their approved application picked — the state a typed
 * plan starts from. */
async function startInstallmentSale(
  page: Page
): Promise<{ customer: { id: string; name: string } }> {
  const { customer, applicationNumber } = await createApprovedApplication(page.request, fx.branchId)
  await openCheckout(page)
  await addItem(page)
  await selectCustomer(page, customer.name)
  await page.getByRole('button', { name: 'Installment', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Select a term…' })).toBeVisible({
    timeout: 10_000,
  })
  // With a single approved application the till picks it on its own; with
  // several (or none picked yet) the cashier does.
  const picked = page.getByRole('combobox', { name: new RegExp(applicationNumber) })
  const picker = page.getByRole('combobox', { name: 'Select an approved application…' })
  await expect(picked.or(picker)).toBeVisible({ timeout: 15_000 })
  if (await picker.isVisible()) {
    await openCustomSelect(picker)
    await page.getByRole('option').filter({ hasText: applicationNumber }).click()
  }
  await expect(picked).toBeVisible({ timeout: 10_000 })
  return { customer }
}

test.describe('POS Checkout — typed installment plan (Scenario 71 Part 2)', () => {
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

  test('PO2-F01: "Type the terms yourself" swaps the term picker for a typed panel seeded from the row, and brings in the reason section', async ({
    page,
  }) => {
    await startInstallmentSale(page)
    await expect(typedPlan(page)).toHaveCount(0)
    await expect(exceptionSection(page)).toHaveCount(0)

    await page.getByTestId('type-terms').click()

    const panel = typedPlan(page)
    await expect(panel).toBeVisible()
    await expect(panel).toContainText('Manual')
    // Seeded: a 12-month plan that covers the sale, first due a month out.
    await expect(panel.getByLabel('Typed months')).toHaveValue('12')
    await expect(panel.getByLabel('First due date')).toHaveValue(todayPlus(0, 1))
    await expect(page.getByTestId('typed-plan-problem')).toHaveCount(0)
    await expect(page.getByTestId('typed-plan-summary')).toContainText('× 12')
    // The Financing Term picker and the 10% floor are gone.
    await expect(page.getByRole('combobox', { name: 'Select a term…' })).toHaveCount(0)
    await expect(page.getByText(/10% min|Fixed at 10%/)).toHaveCount(0)

    const section = exceptionSection(page)
    await expect(section).toBeVisible()
    await expect(section).toContainText('Typed Installment Terms')
  })

  test('PO2-F02: a plan that does not cover the sale, a bad month count and a past date are each called out, and "Use it" fixes the installment', async ({
    page,
  }) => {
    await startInstallmentSale(page)
    await page.getByTestId('type-terms').click()
    const panel = typedPlan(page)
    const problem = page.getByTestId('typed-plan-problem')

    await panel.getByLabel('Typed months').fill('0')
    await expect(problem).toContainText('whole number from 1 to 60')
    await panel.getByLabel('Typed months').fill('61')
    await expect(problem).toContainText('whole number from 1 to 60')

    await panel.getByLabel('Typed months').fill('12')
    await panel.getByLabel('Typed monthly installment').fill('100')
    await expect(problem).toContainText('do not cover the sale')

    // The suggestion that covers it takes the field to the exact amount.
    await page.getByTestId('use-covering-monthly').click()
    await expect(problem).toHaveCount(0)
    await expect(page.getByTestId('typed-plan-summary')).toBeVisible()

    await panel.getByLabel('First due date').fill(todayPlus(-3))
    await expect(problem).toContainText('cannot be in the past')
    await panel.getByLabel('First due date').fill(todayPlus(400))
    await expect(problem).toContainText('more than a year away')
  })

  test('PO2-F03: "50% down · balance in 60 days" fills the plan in one tap', async ({ page }) => {
    await startInstallmentSale(page)
    await page.getByTestId('sixty-day-plan').click()

    const panel = typedPlan(page)
    await expect(panel).toBeVisible()
    await expect(panel.getByLabel('Typed months')).toHaveValue('1')
    await expect(panel.getByLabel('Typed down payment')).toHaveValue('6000.00')
    await expect(panel.getByLabel('Typed monthly installment')).toHaveValue('6000.00')
    await expect(panel.getByLabel('First due date')).toHaveValue(todayPlus(60))
    await expect(page.getByTestId('typed-plan-problem')).toHaveCount(0)
    await expect(page.getByTestId('typed-plan-summary')).toContainText('× 1')
    await expect(exceptionSection(page)).toBeVisible()
  })

  test('PO2-F04: "Use rate card values" goes back to the term picker, and the reason section goes away', async ({
    page,
  }) => {
    await startInstallmentSale(page)
    await page.getByTestId('type-terms').click()
    await expect(typedPlan(page)).toBeVisible()

    await page.getByTestId('use-rate-card').click()

    await expect(typedPlan(page)).toHaveCount(0)
    await expect(
      page.getByRole('combobox', { name: /months|Select a term…/ }).first()
    ).toBeVisible()
    await expect(exceptionSection(page)).toHaveCount(0)
  })

  test('PO2-F05: typed terms are dropped when the line goes to cash', async ({ page }) => {
    await startInstallmentSale(page)
    await page.getByTestId('type-terms').click()
    await expect(typedPlan(page)).toBeVisible()

    await page.getByRole('button', { name: 'Cash', exact: true }).first().click()
    await expect(typedPlan(page)).toHaveCount(0)
    await expect(exceptionSection(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'Installment', exact: true }).click()
    await expect(typedPlan(page)).toHaveCount(0)
    await expect(page.getByTestId('type-terms')).toBeVisible()
  })

  test('PO2-F07: typing the terms of a row that already has a term picked starts from what it is quoting', async ({
    page,
  }) => {
    await startInstallmentSale(page)
    await openCustomSelect(page.getByRole('combobox', { name: 'Select a term…' }))
    const firstTerm = page.getByRole('listbox').getByRole('option').first()
    const quotedMonths = Number(((await firstTerm.textContent()) ?? '').match(/(\d+) months/)![1])
    await firstTerm.click()

    // The monthly the row quotes for that term (its markup included).
    const quote = page.getByText(/₱[\d,]+\.\d{2}\/mo/).first()
    await expect(quote).toBeVisible({ timeout: 10_000 })
    const quoted = ((await quote.textContent()) ?? '').match(/₱([\d,]+\.\d{2})\/mo/)![1]

    await page.getByTestId('type-terms').click()

    const panel = typedPlan(page)
    await expect(panel.getByLabel('Typed months')).toHaveValue(String(quotedMonths))
    await expect(panel.getByLabel('Typed monthly installment')).toHaveValue(
      quoted.replace(/,/g, '')
    )
    await expect(page.getByTestId('typed-plan-problem')).toHaveCount(0)
  })

  test('PO2-F06: a typed plan posts — the schedule has the typed months, installment and first due date, no Financing Term', async ({
    page,
  }) => {
    const { customer } = await startInstallmentSale(page)
    const salesInvoiceNumber = `SI-PO2F06-${Date.now()}`
    const fmi = todayPlus(45)

    await page.getByTestId('type-terms').click()
    const panel = typedPlan(page)
    // No down payment (a friend of management): nothing is collected here.
    await panel.getByLabel('Typed down payment').fill('0')
    await page.getByTestId('use-covering-monthly').click()
    await panel.getByLabel('Typed months').fill('3')
    await page.getByTestId('use-covering-monthly').click()
    await panel.getByLabel('First due date').fill(fmi)
    await expect(page.getByTestId('typed-plan-problem')).toHaveCount(0)
    await expect(page.getByTestId('typed-plan-summary')).toContainText('₱4,000.00/mo × 3')

    const section = exceptionSection(page)
    await openCustomSelect(section.getByRole('combobox', { name: 'Pick a reason…' }))
    await page.getByRole('listbox').getByRole('option', { name: 'Management special' }).click()
    await fillStable(
      section.getByLabel('Note for the price override or typed terms'),
      'Friend of the owner'
    )

    await fillStable(page.getByLabel('Sales Invoice No.'), salesInvoiceNumber)
    await page
      .getByTestId('dp-payment-mode-toggle')
      .getByRole('button', { name: 'Cash', exact: true })
      .click()

    // Not clickStable — this submits a real sale.
    await page.getByRole('button', { name: /Create Installment Plan/ }).click()
    await expect(page.getByText('Installment Plan Created', { exact: true })).toBeVisible({
      timeout: 25_000,
    })

    // What posted, read back through the API.
    const listRes = await page.request.get('/api/pos/transactions', {
      params: { search: salesInvoiceNumber },
    })
    const listBody = await listRes.json()
    const sale = (
      (listBody.data ?? listBody) as { id: string; salesInvoiceNumber: string | null }[]
    ).find((t) => t.salesInvoiceNumber === salesInvoiceNumber)!
    const detail = await (await page.request.get(`/api/pos/transactions/${sale.id}`)).json()
    expect(detail.exceptionNote).toBe('Friend of the owner')
    const line = detail.lines[0]
    expect(line.manualPlan).toBe(true)
    expect(line.financingTermId).toBeNull()
    expect(line.manualTermMonths).toBe(3)
    expect(Number(line.manualMonthlyInstallment)).toBe(4000)
    expect(Number(line.downPayment)).toBe(0)
    expect(String(line.firstDueDate).slice(0, 10)).toBe(fmi)

    // The account the collectors see starts on the same date.
    const accountsRes = await page.request.get('/api/crm/installment-accounts', {
      params: { customerId: customer.id },
    })
    const accountsBody = await accountsRes.json()
    const account = (
      (accountsBody.data ?? accountsBody) as {
        customerId: string
        nextDueDate: string | null
      }[]
    ).find((a) => a.customerId === customer.id)!
    expect(String(account.nextDueDate).slice(0, 10)).toBe(fmi)
  })
})
