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

// Scenario 74 Part 3 — checkout (client notes, 2026-10-16):
//  - "CR number not required for cash payments": Chloe's rule already makes it
//    optional for a plain Cash on Hand / Check sale with no down payment; the
//    field now says "(optional)" there (D3 — label only).
//  - "Add terms, months, and rebate display": an in-house line reads
//    "N months · ₱X/mo … total" with the rebate under it, and the success
//    screen lists Terms and the rebate (D4 — in-house only).
//  - "Use the same selection as POS for CR-BR pricing": "New credit
//    application" from checkout carries the line's Price Use and term (D5 —
//    the first in-house line's, with a notice when the cart's lines differ).
// Case IDs (S74-3-F…) match docs/scenario-74-oct16-client-notes-quick-wins-plan.md.
//
// The seed leaves nothing sellable that also has a price, so the spec builds
// two items, a Price Use and a price list of its own, like the other checkout
// specs. The rebate and quote maths are covered by backend
// test/scenario-74-financing-preview.e2e-spec.ts.

const PREFIX = 'E2E S74 Checkout'
const BRANCH = 'Bago'
const ITEM_PRICE = 12000

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
    const res = await request.post('/api/inventory/items', {
      data: {
        sku: `E2E-S74C-${n}-${stamp}`,
        name,
        baseUnitId,
        isSerialTracked: false,
        sellingPrice: ITEM_PRICE,
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const item = await res.json()
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
      notes: 'E2E Scenario 74 checkout fixture stock',
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
  ).json()) as { id: string; status: string; terminalCode: string }[]
  // Not the Scenario 74 Part 1 test terminal: its sessions are opened and
  // closed by that spec.
  const usable = terminals.filter((t) => t.terminalCode !== 'E2E-S74-PW-01')
  const terminal = usable.find((t) => t.status === 'active') ?? usable[0]
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
  const autoSelected = page.locator('span.rounded-full').filter({ hasText: /Counter|Terminal/ })
  await expect(sessionSelect.or(autoSelected).first()).toBeVisible({ timeout: 15_000 })
  if (await sessionSelect.isVisible()) {
    const options = sessionSelect.locator('option', { hasText: BRANCH })
    // Skip the Part 1 test terminal's session if it happens to be open.
    const count = await options.count()
    for (let i = 0; i < count; i++) {
      const text = (await options.nth(i).textContent()) ?? ''
      if (!text.includes('E2E-S74-PW-01')) {
        await sessionSelect.selectOption((await options.nth(i).getAttribute('value'))!)
        return
      }
    }
  }
}

async function openCheckout(page: Page): Promise<void> {
  await gotoReady(page, '/pos/checkout')
  await pickSessionIfAsked(page)
}

async function addItem(page: Page, index: number, priceUse = fx.priceUseTypeName): Promise<void> {
  const search = page.getByPlaceholder('Search by name or serial')
  await expect(search).toBeVisible({ timeout: 15_000 })
  await search.fill(fx.items[index].name)
  const card = page
    .getByRole('button')
    .filter({ has: page.getByText(fx.items[index].name, { exact: true }) })
  await expect(card.first()).toBeVisible({ timeout: 15_000 })
  await card.first().click()
  await pickCartPriceUse(page, priceUse, index)
}

async function createCustomer(request: APIRequestContext): Promise<{ id: string; name: string }> {
  const stamp = Date.now()
  const name = `${PREFIX} Customer ${stamp}`
  const res = await request.post('/api/crm/customers', {
    data: {
      name,
      customerType: 'individual',
      phone: `0917${stamp.toString().slice(-7)}`,
      coMakers: [
        { name: `${PREFIX} Co-Maker`, relationship: 'Sibling', contactNumber: '09171112222' },
      ],
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const customer = await res.json()
  createdCustomerIds.push(customer.id)
  return { id: customer.id, name }
}

async function selectCustomer(page: Page, name: string): Promise<void> {
  const input = page.getByPlaceholder('Search by name or phone…')
  await input.click()
  await fillStable(input, name)
  await page.getByRole('button', { name: new RegExp(name) }).click()
}

/** draft → submit → investigate → decide, as the Business Owner. */
async function approveApplication(
  request: APIRequestContext,
  customerId: string,
  itemIds: string[]
): Promise<string> {
  const customer = await (await request.get(`/api/crm/customers/${customerId}`)).json()
  const appRes = await request.post('/api/credit/applications', {
    data: {
      branchId: fx.branchId,
      applicantCustomerId: customerId,
      coMakerId: (customer.data ?? customer).coMakers[0].id,
      priceUseTypeId: fx.priceUseTypeId,
      items: itemIds.map((itemId) => ({ itemId })),
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
  return application.applicationNumber as string
}

const termPicker = (page: Page) => page.getByRole('combobox', { name: /Select a term…|months$/ })

/** Item 1 on an in-house installment line, the applicant picked with an
 * approved application, and the first term chosen. */
async function readyInhouseLine(page: Page): Promise<void> {
  const customer = await createCustomer(page.request)
  const applicationNumber = await approveApplication(page.request, customer.id, [fx.items[0].id])
  await openCheckout(page)
  await addItem(page, 0)
  await selectCustomer(page, customer.name)
  await page.getByRole('button', { name: 'Installment', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Select a term…' })).toBeVisible({
    timeout: 10_000,
  })
  const picked = page.getByRole('combobox', { name: new RegExp(applicationNumber) })
  const picker = page.getByRole('combobox', { name: 'Select an approved application…' })
  await expect(picked.or(picker)).toBeVisible({ timeout: 15_000 })
  if (await picker.isVisible()) {
    await openCustomSelect(picker)
    await page.getByRole('option').filter({ hasText: applicationNumber }).click()
  }
  await openCustomSelect(page.getByRole('combobox', { name: 'Select a term…' }))
  await page.getByRole('listbox').getByRole('option').first().click()
  await expect(page.getByTestId('installment-terms')).toBeVisible({ timeout: 15_000 })
  // The down payment's own tender: the CR box only appears once it is picked.
  await page
    .getByTestId('dp-payment-mode-toggle')
    .getByRole('button', { name: 'Cash', exact: true })
    .click()
}

test.describe('Scenario 74 Part 3 — checkout terms, rebate, CR and credit application', () => {
  test.describe.configure({ mode: 'serial' })

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
      for (const i of fx.items) await request.delete(`/api/inventory/items/${i.id}`).catch(() => {})
    }
    await request.dispose()
  })

  test('S74-3-F01 — a plain Cash on Hand sale marks the CR number "(optional)"', async ({
    page,
  }) => {
    await openCheckout(page)
    await addItem(page, 0)
    const cr = page.getByRole('textbox', { name: /^CR Number/ })
    await expect(cr).toBeVisible()
    await expect(page.getByTestId('cr-optional')).toBeVisible()
    await expect(page.getByTestId('cr-optional')).toHaveText('(optional)')
  })

  test('S74-3-F02 (edge) — an in-house installment with a down payment still requires the CR', async ({
    page,
  }) => {
    await readyInhouseLine(page)
    await expect(page.getByRole('textbox', { name: /^CR Number/ })).toBeVisible()
    await expect(page.getByTestId('cr-optional')).toHaveCount(0)
  })

  test('S74-3-F03 (edge) — GCash keeps its reference required', async ({ page }) => {
    await openCheckout(page)
    await addItem(page, 0)
    const gcash = page.getByRole('button', { name: 'GCash', exact: true })
    test.skip(!(await gcash.isVisible()), 'GCash is not enabled at this branch.')
    await gcash.click()
    await expect(page.getByTestId('cr-optional')).toHaveCount(0)
  })

  test('S74-3-F04 — an in-house line shows months, monthly, total and the rebate; a new term updates it', async ({
    page,
  }) => {
    await readyInhouseLine(page)
    const terms = page.getByTestId('installment-terms')
    await expect(terms).toContainText(/\d+ months · ₱[\d,]+\.\d{2}\/mo/)
    await expect(terms).toContainText(/total/)
    await expect(page.getByTestId('installment-rebate')).toContainText(
      /Rebate ₱[\d,]+\.\d{2}\/mo when paid in full by the due date/
    )

    const before = await terms.textContent()
    await openCustomSelect(termPicker(page))
    const options = page.getByRole('listbox').getByRole('option')
    test.skip((await options.count()) < 2, 'Only one financing term is active at this branch.')
    await options.nth(1).click()
    await expect(terms).not.toHaveText(before!)
    await expect(terms).toContainText(/\d+ months · /)
  })

  test('S74-3-F05 — the success screen lists the terms and the rebate', async ({ page }) => {
    await readyInhouseLine(page)
    const months = (await page.getByTestId('installment-terms').textContent())!.match(
      /(\d+) months/
    )![1]
    const rebate = (await page.getByTestId('installment-rebate').textContent())!.match(
      /₱[\d,]+\.\d{2}/
    )![0]

    await fillStable(page.getByLabel('Sales Invoice No.'), `SI-S74F05-${Date.now()}`)
    await fillStable(page.getByLabel('Amount received'), '100000')
    await fillStable(page.getByRole('textbox', { name: /^CR Number/ }), `CR-S74F05-${Date.now()}`)
    await page.getByRole('button', { name: /Create Installment Plan/ }).click()
    await expect(page.getByText('Installment Plan Created', { exact: true })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByTestId('success-term-months')).toHaveText(`${months} months`)
    await expect(page.getByTestId('success-rebate')).toHaveText(`${rebate}/mo`)
  })

  test('S74-3-F06 (edge) — a TPF line shows no rebate', async ({ page }) => {
    await readyInhouseLine(page)
    await page.getByRole('button', { name: 'TPF Installment', exact: true }).first().click()
    await expect(page.getByTestId('installment-rebate')).toHaveCount(0)
    await expect(page.getByTestId('installment-terms')).toHaveCount(0)
  })

  test('S74-3-F07 — "New credit application" from checkout opens on the line’s Price Use and term', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request)
    await openCheckout(page)
    await addItem(page, 0)
    await selectCustomer(page, customer.name)
    await page.getByRole('button', { name: 'Installment', exact: true }).click()
    await openCustomSelect(page.getByRole('combobox', { name: 'Select a term…' }))
    const option = page.getByRole('listbox').getByRole('option').first()
    const termLabel = (await option.textContent())!.trim()
    await option.click()

    await page
      .getByRole('button', { name: /New credit application|New application for this cart/ })
      .first()
      .click()
    await expect(page).toHaveURL(/\/pos\/credit-applications\/new/, { timeout: 20_000 })
    // The form's Price Use and term selects carry the cart's picks.
    await expect(
      page.locator('select, [role="combobox"]').filter({ hasText: fx.priceUseTypeName }).first()
    ).toBeVisible({ timeout: 20_000 })
    await expect(
      page.locator('select, [role="combobox"]').filter({ hasText: termLabel }).first()
    ).toBeVisible()
    await expect(page.getByTestId('price-use-notice')).toHaveCount(0)
  })

  test('S74-3-F08 (edge) — installment lines on different Price Uses: the first line’s, with a notice', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request)
    await openCheckout(page)
    await addItem(page, 0)
    await addItem(page, 1, 'WIP')
    await selectCustomer(page, customer.name)
    await page.getByRole('button', { name: 'Installment', exact: true }).click()
    await page
      .getByRole('button', { name: /New credit application|New application for this cart/ })
      .first()
      .click()
    await expect(page).toHaveURL(/\/pos\/credit-applications\/new/, { timeout: 20_000 })
    const notice = page.getByTestId('price-use-notice')
    await expect(notice).toBeVisible({ timeout: 20_000 })
    await expect(notice).toContainText(fx.priceUseTypeName)
  })

  test('S74-3-F09 (edge) — a new application opened from the list (no draft) shows no notice', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/credit-applications/new')
    await expect(page.getByText(/Price Use/).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('price-use-notice')).toHaveCount(0)
  })
})
