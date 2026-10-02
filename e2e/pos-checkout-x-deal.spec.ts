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

// Scenario 65 — X-Deal (barter) at POS checkout. The backend rules (cart
// shape, ₱0 down payment, no credit application, reference required) are
// covered by backend/test/pos-x-deal-checkout.e2e-spec.ts; this spec covers
// the checkout UI that drives them, plus the X-DEAL badge wherever the sale
// and its installment account are listed. Case IDs (XD-F…) match
// docs/scenario-65-x-deal-transaction-plan.md.
//
// The seed leaves nothing sellable that also has a price, so this spec builds
// its own: a fresh non-serial item, stocked at Bago, priced on a dedicated
// Price Use + price list of its own (never the shared WIP list — adding an
// item to an active list reverts it to pending).

const PREFIX = 'E2E XDeal'
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
      sku: `E2E-XDEAL-${stamp}`,
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
      notes: 'E2E X-Deal fixture stock',
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

async function ensureOpenSession(request: APIRequestContext, branchId: string): Promise<void> {
  const terminals = (await (
    await request.get('/api/pos/terminals', { params: { branchId } })
  ).json()) as { id: string; status: string }[]
  const terminal = terminals.find((t) => t.status === 'active') ?? terminals[0]
  const open = (await (
    await request.get('/api/pos/sessions', { params: { terminalId: terminal.id, status: 'open' } })
  ).json()) as { id: string }[]
  // Reused rather than closed: closing needs the declared cash to match the
  // expected amount (or a manager override), so a rerun would otherwise fail.
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
  // Wait for the session list to load before deciding: the picker only
  // renders once it knows there's more than one session, and the counter
  // chip only once it has auto-selected the single one.
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

async function pickFirstTerm(page: Page): Promise<void> {
  const termSelect = page.locator('select').filter({ hasText: 'Select a term' })
  await expect(termSelect).toBeVisible({ timeout: 10_000 })
  await termSelect.selectOption({ index: 1 })
}

const xDealCheckbox = (page: Page) => page.getByTestId('x-deal-checkbox')
const xDealReference = (page: Page) => page.getByTestId('x-deal-reference')

test.describe('POS Checkout — X-Deal (Scenario 65)', () => {
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

  test('XD-F01: the X-Deal checkbox only appears once a customer is selected', async ({ page }) => {
    const customer = await createCustomer(page.request, 'F01')
    await openCheckout(page)
    await addItem(page)

    await expect(xDealCheckbox(page)).toHaveCount(0)
    await selectCustomer(page, customer.name)
    await expect(xDealCheckbox(page)).toBeVisible()
    await expect(xDealCheckbox(page)).not.toBeChecked()
    await expect(xDealReference(page)).toHaveCount(0)
  })

  test('XD-F02 / XD-F07: ticking X-Deal forces inhouse installment, waives the down payment, hides the credit application and locks Cash, Delivery Receipt and TPF', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'F02')
    await openCheckout(page)
    await addItem(page)
    await selectCustomer(page, customer.name)

    await xDealCheckbox(page).check()

    await expect(xDealReference(page)).toBeVisible()
    await expect(page.getByText('X-Deal — no credit application required.')).toBeVisible()
    await expect(page.getByText('Approved Credit Application')).toHaveCount(0)
    await expect(page.getByTestId('dp-payment-mode-toggle')).toHaveCount(0)

    await expect(page.getByRole('button', { name: 'Delivery Receipt', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Cash', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'TPF Installment', exact: true })).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Inhouse Installment', exact: true })
    ).toBeEnabled()

    await pickFirstTerm(page)
    await expect(page.getByText('Waived', { exact: true })).toBeVisible()
    await expect(page.getByText('X-Deal', { exact: true })).toBeVisible()
  })

  test('XD-F03: Confirm is blocked without a reference, including a whitespace-only one', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'F03')
    await openCheckout(page)
    await addItem(page)
    await selectCustomer(page, customer.name)
    await xDealCheckbox(page).check()
    await pickFirstTerm(page)
    await fillStable(page.getByLabel('Sales Invoice No.'), `SI-XDF03-${Date.now()}`)

    let posted = false
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/pos/transactions')) posted = true
    })

    for (const value of ['', '   ']) {
      await xDealReference(page).fill(value)
      const confirm = page.getByRole('button', { name: 'Enter the X-Deal reference' })
      await expect(confirm).toBeVisible()
      await confirm.click()
      await expect(page.getByText('Enter the X-Deal reference.', { exact: true })).toBeVisible()
    }
    expect(posted).toBe(false)
  })

  test('XD-F04: unticking restores the credit application, the down-payment method and the payment-mode choices', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'F04')
    await openCheckout(page)
    await addItem(page)
    await selectCustomer(page, customer.name)

    await xDealCheckbox(page).check()
    await pickFirstTerm(page)
    await expect(page.getByText('Waived', { exact: true })).toBeVisible()

    await xDealCheckbox(page).uncheck()

    await expect(xDealReference(page)).toHaveCount(0)
    await expect(page.getByText('Approved Credit Application', { exact: true })).toBeVisible()
    await expect(page.getByTestId('dp-payment-mode-toggle')).toBeVisible()
    await expect(page.getByText('Waived', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Delivery Receipt', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'TPF Installment', exact: true })).toBeEnabled()
  })

  test('XD-F05: X-Deal and Employee Appliance Loan cannot both be on', async ({ page }) => {
    const customer = await createCustomer(page.request, 'F05', {
      customerType: 'employee',
      employeeNumber: `EMP-XDF05-${Date.now()}`,
    })
    await openCheckout(page)
    await addItem(page)
    await selectCustomer(page, customer.name)

    const employeeLoan = page.getByRole('checkbox', { name: /Employee Appliance Loan/ })
    // Auto-checked for an employee-tagged customer.
    await expect(employeeLoan).toBeChecked()

    await xDealCheckbox(page).check()
    await expect(employeeLoan).not.toBeChecked()

    await employeeLoan.check()
    await expect(xDealCheckbox(page)).not.toBeChecked()
  })

  test('XD-F06: changing the customer resets the X-Deal and its reference', async ({ page }) => {
    const first = await createCustomer(page.request, 'F06a')
    const second = await createCustomer(page.request, 'F06b')
    await openCheckout(page)
    await addItem(page)
    await selectCustomer(page, first.name)
    await xDealCheckbox(page).check()
    await xDealReference(page).fill('XD-REF-F06')

    await page.getByRole('button', { name: 'Clear customer' }).click()
    await selectCustomer(page, second.name)

    await expect(xDealCheckbox(page)).not.toBeChecked()
    await xDealCheckbox(page).check()
    await expect(xDealReference(page)).toHaveValue('')
  })

  test('XD-F09: X-Deal is unavailable offline', async ({ page }) => {
    const customer = await createCustomer(page.request, 'F09')
    await openCheckout(page)
    await addItem(page)
    await selectCustomer(page, customer.name)

    await page.context().setOffline(true)
    try {
      await expect(xDealCheckbox(page)).toBeDisabled()
      await expect(page.getByText('Unavailable offline')).toBeVisible()
    } finally {
      await page.context().setOffline(false)
    }
    await expect(xDealCheckbox(page)).toBeEnabled()
  })

  test('XD-F10 / XD-F11: a double-clicked Confirm posts one X-Deal, badged on the success screen, the transactions list and detail, and the installment ledger', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'F11')
    const reference = `XD-REF-F11-${Date.now()}`
    const salesInvoiceNumber = `SI-XDF11-${Date.now()}`

    await openCheckout(page)
    await addItem(page)
    await selectCustomer(page, customer.name)
    await xDealCheckbox(page).check()
    await xDealReference(page).fill(reference)
    await pickFirstTerm(page)
    await fillStable(page.getByLabel('Sales Invoice No.'), salesInvoiceNumber)

    // Not clickStable — this submits a real sale.
    await page.getByRole('button', { name: /Create Installment Plan/ }).dblclick()
    await expect(page.getByText('Installment Plan Created', { exact: true })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByTestId('x-deal-badge')).toBeVisible()

    // XD-F10 — exactly one sale.
    const listRes = await page.request.get('/api/pos/transactions', {
      params: { search: salesInvoiceNumber },
    })
    const listBody = await listRes.json()
    const sales = (
      (listBody.data ?? listBody) as {
        id: string
        salesInvoiceNumber: string | null
        isXDeal: boolean
        xDealReference: string | null
      }[]
    ).filter((t) => t.salesInvoiceNumber === salesInvoiceNumber)
    expect(sales).toHaveLength(1)
    expect(sales[0].isXDeal).toBe(true)
    expect(sales[0].xDealReference).toBe(reference)

    // Transactions list + detail.
    await gotoReady(page, '/pos/transactions')
    const row = page.locator('tr', { hasText: salesInvoiceNumber })
    // Re-type until the row shows: on a cold dev-server compile the list can
    // still be hydrating when the first fill lands, which wipes the search.
    await expect(async () => {
      await fillStable(page.getByPlaceholder('Search…'), salesInvoiceNumber)
      await expect(row).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 45_000 })
    await expect(row.getByTestId('x-deal-badge')).toBeVisible()
    await row.click()
    await expect(page.getByText('X-Deal Reference', { exact: true })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText(reference, { exact: true })).toBeVisible()

    // Installment ledger.
    const accountsRes = await page.request.get('/api/crm/installment-accounts', {
      params: { customerId: customer.id },
    })
    const accountsBody = await accountsRes.json()
    const accounts = (accountsBody.data ?? accountsBody) as {
      id: string
      customerId: string
      isXDeal: boolean
    }[]
    const account = accounts.find((a) => a.customerId === customer.id)!
    expect(account.isXDeal).toBe(true)
    await gotoReady(page, `/crm/customers/${customer.id}/installments/${account.id}`)
    await expect(page.getByTestId('x-deal-badge')).toBeVisible({ timeout: 15_000 })
  })

  test('XD-F08: a parked X-Deal resumes as an X-Deal with its reference, and completes', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'F08')
    const reference = `XD-REF-F08-${Date.now()}`
    const parkLabel = `${PREFIX} park ${Date.now()}`

    await openCheckout(page)
    await addItem(page)
    await selectCustomer(page, customer.name)
    await xDealCheckbox(page).check()
    await xDealReference(page).fill(reference)
    await pickFirstTerm(page)

    await page.getByRole('button', { name: 'Park Sale' }).first().click()
    await page.getByPlaceholder('e.g. Customer waiting on size').fill(parkLabel)
    await page.getByRole('button', { name: 'Park Sale' }).last().click()
    await expect(page.getByTestId('x-deal-panel')).toHaveCount(0, { timeout: 10_000 })

    await gotoReady(page, '/pos/parked-sales')
    const parkedRow = page.locator('tr, li, div').filter({ hasText: parkLabel }).last()
    await expect(parkedRow).toBeVisible({ timeout: 15_000 })
    await parkedRow.getByRole('button', { name: /Resume/ }).click()

    await expect(page).toHaveURL(/\/pos\/checkout/, { timeout: 15_000 })
    await pickSessionIfAsked(page)

    await expect(xDealCheckbox(page)).toBeChecked({ timeout: 15_000 })
    await expect(xDealReference(page)).toHaveValue(reference)

    await fillStable(page.getByLabel('Sales Invoice No.'), `SI-XDF08-${Date.now()}`)
    await page.getByRole('button', { name: /Create Installment Plan/ }).click()
    await expect(page.getByText('Installment Plan Created', { exact: true })).toBeVisible({
      timeout: 45_000,
    })
    await expect(page.getByTestId('x-deal-badge')).toBeVisible()
  })
})
