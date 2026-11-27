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
  deleteCustomers,
  sweepE2EPriceLists,
  sweepE2EPriceUseTypes,
  openCustomSelect,
  pickCartPriceUse,
  pickCheckoutSession,
} from './utils'

// Docket #92 — a Split aircon is sold under one of five Split price uses, each
// limiting its own payment types and terms; a 0% installment on SPLIT REGULAR /
// OUT OF TOWN needs a reason and shows in the end-of-day review. The server side
// is covered by backend/test/pos-split-price-use-rules.e2e-spec.ts (SP-E…); this
// spec covers what the cashier sees and can do at checkout (SP-F…).
//
// The five uses are created here through the admin price-use-types API with the
// same rules the production backfill gives the real ones, plus one use with no
// rules, so the spec never depends on staging data. Terms: the seed's 3 / 6 / 9 /
// 12-month terms carry interest; one 5-month fixture term at 1.00x is the 0% term.

const PREFIX = 'E2E Split'
const BRANCH = 'Bago'
const ITEM_PRICE = 12000

type UseKey = 'ZI' | 'TERM' | 'CASH' | 'REGULAR' | 'OUT_OF_TOWN' | 'ODD_CARD' | 'NO_RULES'
type Fixtures = {
  itemNames: string[]
  itemIds: string[]
  use: Record<UseKey, { id: string; name: string; listId: string }>
  branchId: string
  zeroTermId: string
}

const RULES: Record<UseKey, Record<string, unknown>> = {
  ZI: {
    allowedPaymentTypes: ['inhouse', 'tpf'],
    allowedTermMonths: [3],
    allowTypedPlan: false,
  },
  TERM: {
    allowedPaymentTypes: ['inhouse', 'tpf'],
    allowedTermMonths: [6, 9, 12],
    allowTypedPlan: false,
  },
  CASH: { allowedPaymentTypes: ['cash', 'tpf'], allowTypedPlan: false },
  REGULAR: {
    allowedPaymentTypes: ['cash', 'inhouse', 'tpf'],
    maxTermMonths: 12,
    allowTypedPlan: true,
    zeroPercentNeedsReason: true,
  },
  OUT_OF_TOWN: {
    allowedPaymentTypes: ['cash', 'inhouse', 'tpf'],
    maxTermMonths: 12,
    allowTypedPlan: true,
    zeroPercentNeedsReason: true,
  },
  // A use that asks a 0% reason, for SP-F13's price row with monthlies only.
  ODD_CARD: { maxTermMonths: 12, zeroPercentNeedsReason: true },
  NO_RULES: {},
}

let fx: Fixtures

async function ownerRequest(
  playwright: PlaywrightWorkerArgs['playwright'],
  baseURL: string
): Promise<APIRequestContext> {
  return playwright.request.newContext({
    baseURL,
    storageState: 'e2e/.auth/business-owner.json',
  })
}

async function createItem(
  request: APIRequestContext,
  baseUnitId: string,
  warehouseId: string,
  name: string,
  stamp: number,
  n: number
): Promise<string> {
  const itemRes = await request.post('/api/inventory/items', {
    data: {
      sku: `E2E-SPLIT-${stamp}-${n}`,
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
  const adjustRes = await request.post('/api/inventory/adjustments', {
    data: {
      warehouseId,
      adjustmentDate: new Date().toISOString().slice(0, 10),
      reasonCode: 'found',
      notes: 'E2E split price use fixture stock',
      lines: [{ itemId: item.id, expectedQty: 0, actualQty: 50 }],
    },
  })
  expect(adjustRes.ok(), await adjustRes.text()).toBeTruthy()
  const adjustment = await adjustRes.json()
  for (const step of ['confirm', 'investigate', 'approve']) {
    const stepRes = await request.patch(`/api/inventory/adjustments/${adjustment.id}/${step}`)
    expect(stepRes.ok(), await stepRes.text()).toBeTruthy()
  }
  return item.id as string
}

async function createUse(
  request: APIRequestContext,
  key: UseKey,
  stamp: number,
  itemIds: string[]
): Promise<{ id: string; name: string; listId: string }> {
  const name = `${PREFIX} ${key.replace('_', ' ')} ${stamp}`
  const useRes = await request.post('/api/inventory/price-use-types', {
    data: { name, ...RULES[key] },
  })
  expect(useRes.ok(), await useRes.text()).toBeTruthy()
  const use = await useRes.json()
  const listRes = await request.post('/api/inventory/price-lists', {
    data: { name: `${PREFIX} List ${key} ${stamp}`, priceUseTypeId: use.id },
  })
  expect(listRes.ok(), await listRes.text()).toBeTruthy()
  const list = await listRes.json()
  const itemsRes = await request.post(`/api/inventory/price-lists/${list.id}/items`, {
    data: { items: itemIds.map((itemId) => ({ itemId, price: ITEM_PRICE })) },
  })
  expect(itemsRes.ok(), await itemsRes.text()).toBeTruthy()
  const approveRes = await request.post(`/api/inventory/price-lists/${list.id}/approve`, {
    data: {},
  })
  expect(approveRes.ok(), await approveRes.text()).toBeTruthy()
  return { id: use.id as string, name, listId: list.id as string }
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
  const warehouseId = warehouses.find((w) => w.branchId === branchId)!.id

  const itemNames = [`${PREFIX} Aircon A ${stamp}`, `${PREFIX} Aircon B ${stamp}`]
  const itemIds: string[] = []
  for (const [n, name] of itemNames.entries()) {
    itemIds.push(await createItem(request, baseUnitId, warehouseId, name, stamp, n))
  }

  const use = {} as Fixtures['use']
  for (const key of Object.keys(RULES) as UseKey[]) {
    use[key] = await createUse(request, key, stamp, itemIds)
  }

  const termRes = await request.post('/api/pos/financing-terms', {
    data: { termMonths: 5, factorRate: 1, notes: 'E2E split 0% fixture term' },
  })
  expect(termRes.ok(), await termRes.text()).toBeTruthy()
  const zeroTermId = ((await termRes.json()) as { id: string }).id

  return { itemNames, itemIds, use, branchId, zeroTermId }
}

async function ensureOpenSession(request: APIRequestContext, branchId: string): Promise<void> {
  const terminals = (await (
    await request.get('/api/pos/terminals', { params: { branchId } })
  ).json()) as { id: string; status: string }[]
  const terminal = terminals.find((t) => t.status === 'active') ?? terminals[0]
  const open = (await (
    await request.get('/api/pos/sessions', { params: { terminalId: terminal.id, status: 'open' } })
  ).json()) as { id: string }[]
  // Reused rather than closed: closing needs the declared cash to match.
  if (open.length) return
  await request.post('/api/pos/sessions/open', {
    data: { terminalId: terminal.id, openingCash: 1000 },
  })
}

async function openCheckout(page: Page): Promise<void> {
  await gotoReady(page, '/pos/checkout')
  await pickCheckoutSession(page, BRANCH)
}

async function addItem(page: Page, itemName: string): Promise<void> {
  const search = page.getByPlaceholder('Search by name or serial')
  await expect(search).toBeVisible({ timeout: 15_000 })
  await search.fill(itemName)
  const card = page.getByRole('button').filter({ has: page.getByText(itemName, { exact: true }) })
  await expect(card.first()).toBeVisible({ timeout: 15_000 })
  await card.first().click()
  await expect(page.locator('tr', { hasText: itemName })).toBeVisible({ timeout: 10_000 })
}

/** Opens checkout with item A in the cart under the given use. */
async function startSale(page: Page, key: UseKey): Promise<void> {
  await openCheckout(page)
  await addItem(page, fx.itemNames[0])
  await pickCartPriceUse(page, fx.use[key].name)
}

async function termOptions(page: Page): Promise<string[]> {
  const trigger = page.getByTestId('installment-plan').getByRole('combobox').first()
  await openCustomSelect(trigger)
  const texts = (await page.getByRole('option').allTextContents()).map((t) => t.trim())
  await trigger.press('Escape')
  return texts
}

async function pickTerm(page: Page, label: string): Promise<void> {
  const trigger = page.getByTestId('installment-plan').getByRole('combobox').first()
  await openCustomSelect(trigger)
  await page.getByRole('option', { name: label }).first().click()
  // The plan preview is fetched after a short delay.
  await page.waitForTimeout(2_000)
}

const cashButton = (page: Page) => page.getByTestId('payment-mode-cash')
const installmentButton = (page: Page) => page.getByTestId('payment-mode-installment')
const inhouseButton = (page: Page) => page.getByTestId('payment-provider-inhouse')
const tpfButton = (page: Page) => page.getByTestId('payment-provider-tpf')
const exceptionSection = (page: Page) => page.getByTestId('price-override-exception')
const notice = (page: Page) => page.getByTestId('price-use-rule-notice')

const createdCustomerIds: string[] = []

async function createCustomer(
  request: APIRequestContext,
  tag: string
): Promise<{ id: string; name: string; coMakerId: string }> {
  const stamp = Date.now()
  const name = `${PREFIX} Customer ${tag} ${stamp}`
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
  return { id: customer.id, name, coMakerId: customer.coMakers[0].id }
}

async function selectCustomer(page: Page, name: string): Promise<void> {
  const input = page.getByPlaceholder('Search by name or phone…')
  await input.click()
  await fillStable(input, name)
  await page.getByRole('button', { name: new RegExp(name) }).click()
}

/** An approved credit application (submitting one approves it) for item A on the given use, made through the
 * app's own API as the Business Owner. */
async function createApprovedApplication(
  request: APIRequestContext,
  key: UseKey
): Promise<{ customer: { id: string; name: string }; applicationNumber: string }> {
  const customer = await createCustomer(request, `App ${key}`)
  const appRes = await request.post('/api/credit/applications', {
    data: {
      branchId: fx.branchId,
      applicantCustomerId: customer.id,
      coMakerId: customer.coMakerId,
      priceUseTypeId: fx.use[key].id,
      items: [{ itemId: fx.itemIds[0] }],
    },
  })
  expect(appRes.ok(), await appRes.text()).toBeTruthy()
  const application = await appRes.json()
  const upload = await request.post('/api/files/upload', {
    multipart: { file: { name: 'id.txt', mimeType: 'text/plain', buffer: Buffer.from('fake id') } },
  })
  const file = await upload.json()
  const steps: [string, string, object?][] = [
    [
      'post',
      `/api/credit/applications/${application.id}/documents`,
      { fileId: file.id, documentType: 'applicant_id' },
    ],
    ['patch', `/api/credit/applications/${application.id}/submit`],
  ]
  for (const [method, url, data] of steps) {
    const res = await (method === 'post'
      ? request.post(url, { data })
      : request.patch(url, { data }))
    expect(res.ok(), `${method} ${url}: ${await res.text()}`).toBeTruthy()
  }
  return {
    customer: { id: customer.id, name: customer.name },
    applicationNumber: application.applicationNumber as string,
  }
}

async function pickApplication(page: Page, applicationNumber: string): Promise<void> {
  const picked = page.getByRole('combobox', { name: new RegExp(applicationNumber) })
  const picker = page.getByRole('combobox', { name: 'Select an approved application…' })
  await expect(picked.or(picker)).toBeVisible({ timeout: 15_000 })
  if (await picker.isVisible()) {
    await openCustomSelect(picker)
    await page.getByRole('option').filter({ hasText: applicationNumber }).click()
  }
  await expect(picked).toBeVisible({ timeout: 10_000 })
}

async function fillReason(page: Page, note: string): Promise<void> {
  const section = exceptionSection(page)
  await openCustomSelect(section.getByRole('combobox', { name: 'Pick a reason…' }))
  await page.getByRole('listbox').getByRole('option', { name: 'Management special' }).click()
  await fillStable(section.getByLabel(/^Note for the price override/), note)
}

/** Takes the down payment in cash as the toggle states it and creates the plan. */
async function payDownPayment(page: Page, invoice: string): Promise<void> {
  await fillStable(page.getByLabel('Sales Invoice No.'), invoice)
  await page
    .getByTestId('dp-payment-mode-toggle')
    .getByRole('button', { name: 'Cash', exact: true })
    .click()
  const dpText = await page.getByTestId('dp-payment-mode-toggle').innerText()
  const dp = dpText.match(/₱([\d,]+\.\d{2})/)![1].replace(/,/g, '')
  await fillStable(page.getByLabel('Amount received'), dp)
  // Not clickStable — this submits a real sale.
  await page.getByRole('button', { name: /Create Installment Plan/ }).click()
  await expect(page.getByText('Installment Plan Created', { exact: true })).toBeVisible({
    timeout: 30_000,
  })
}

/** A full in-house installment sale on one use and one term; returns the invoice. */
async function sellInstallment(
  page: Page,
  key: UseKey,
  term: string,
  tag: string,
  needsReason = false
): Promise<string> {
  const { customer, applicationNumber } = await createApprovedApplication(page.request, key)
  await startSale(page, key)
  await selectCustomer(page, customer.name)
  await installmentButton(page).click()
  await inhouseButton(page).click()
  await pickApplication(page, applicationNumber)
  await pickTerm(page, term)
  if (needsReason) await fillReason(page, 'Split rules e2e 0%')
  else await expect(exceptionSection(page)).toHaveCount(0)
  const invoice = `SI-SPL-${tag}-${Date.now()}`
  await payDownPayment(page, invoice)
  return invoice
}

/** Fills the TPF provider and references and confirms; returns the invoice. */
async function finishTpf(page: Page, tag: string): Promise<string> {
  await openCustomSelect(page.getByRole('combobox', { name: 'Select a TPF provider…' }))
  await page.getByRole('listbox').getByRole('option').first().click()
  await fillStable(
    page.getByPlaceholder("Financier's reference number *"),
    `TPF-${tag}-${Date.now()}`
  )
  const invoice = `SI-SPL-${tag}-${Date.now()}`
  await payDownPayment(page, invoice)
  return invoice
}

async function saleDetail(page: Page, invoice: string) {
  const listRes = await page.request.get('/api/pos/transactions', { params: { search: invoice } })
  const body = await listRes.json()
  const sale = ((body.data ?? body) as { id: string; salesInvoiceNumber: string | null }[]).find(
    (t) => t.salesInvoiceNumber === invoice
  )!
  expect(sale, `sale ${invoice}`).toBeTruthy()
  return await (await page.request.get(`/api/pos/transactions/${sale.id}`)).json()
}

async function overrideEntryFor(page: Page, invoice: string) {
  await gotoReady(page, `/pos/override-review?branchId=${fx.branchId}`)
  await page.waitForTimeout(1_500)
  return page.getByTestId('override-entry').filter({ hasText: invoice })
}

async function openDetails(entry: ReturnType<Page['locator']>): Promise<void> {
  const toggle = entry.getByTestId('entry-toggle')
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  await expect(entry.getByTestId('entry-details')).toBeVisible()
}

test.describe('POS Checkout — Split price use rules (Docket #92)', () => {
  test.beforeAll(async ({ playwright }, testInfo) => {
    test.setTimeout(240_000)
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
      await request
        .patch(`/api/pos/financing-terms/${fx.zeroTermId}`, { data: { isActive: false } })
        .catch(() => {})
      for (const u of Object.values(fx.use)) {
        await request.delete(`/api/inventory/price-lists/${u.listId}`).catch(() => {})
        await request.delete(`/api/inventory/price-use-types/${u.id}`).catch(() => {})
      }
      for (const id of fx.itemIds)
        await request.delete(`/api/inventory/items/${id}`).catch(() => {})
    }
    await request.dispose()
  })

  test('SP-F01: each use disables the payment options it is not sold for, each with the reason as a tooltip', async ({
    page,
  }) => {
    await startSale(page, 'CASH')
    await expect(cashButton(page)).toBeEnabled()
    // TPF is allowed on every use, so Installment stays on offer (to pick TPF);
    // it is the in-house provider that is out.
    await installmentButton(page).click()
    await expect(inhouseButton(page)).toBeDisabled()
    await expect(inhouseButton(page)).toHaveAttribute(
      'title',
      `${fx.use.CASH.name} is sold for cash or TPF only.`
    )
    await expect(tpfButton(page)).toBeEnabled()

    await pickCartPriceUse(page, fx.use.ZI.name)
    await expect(cashButton(page)).toBeDisabled()
    await expect(cashButton(page)).toHaveAttribute(
      'title',
      `${fx.use.ZI.name} is sold for installment or TPF only.`
    )
    await expect(installmentButton(page)).toBeEnabled()

    await pickCartPriceUse(page, fx.use.TERM.name)
    await expect(cashButton(page)).toBeDisabled()

    for (const key of ['REGULAR', 'OUT_OF_TOWN'] as const) {
      await pickCartPriceUse(page, fx.use[key].name)
      await expect(cashButton(page)).toBeEnabled()
      await installmentButton(page).click()
      await expect(inhouseButton(page)).toBeEnabled()
      await expect(tpfButton(page)).toBeEnabled()
    }
  })

  test('SP-F02: the term list shows only the terms each use allows', async ({ page }) => {
    await startSale(page, 'ZI')
    await installmentButton(page).click()
    await expect(page.getByTestId('installment-plan')).toBeVisible({ timeout: 10_000 })
    expect(await termOptions(page)).toEqual(['3 months'])

    await pickCartPriceUse(page, fx.use.TERM.name)
    const term = await termOptions(page)
    expect(term).toEqual(expect.arrayContaining(['6 months', '9 months', '12 months']))
    expect(term).not.toContain('3 months')

    for (const key of ['REGULAR', 'OUT_OF_TOWN'] as const) {
      await pickCartPriceUse(page, fx.use[key].name)
      const regular = await termOptions(page)
      expect(regular).toEqual(expect.arrayContaining(['3 months', '6 months', '12 months']))
      // Nothing over twelve months, whatever terms exist.
      for (const t of regular) expect(Number(t.match(/^(\d+)/)?.[1] ?? 0)).toBeLessThanOrEqual(12)
    }
  })

  test('SP-F03: typed-plan buttons are hidden with a note where the use does not allow them, and shown where it does', async ({
    page,
  }) => {
    await startSale(page, 'ZI')
    await installmentButton(page).click()
    await expect(page.getByTestId('installment-plan')).toBeVisible({ timeout: 10_000 })
    for (const key of ['ZI', 'TERM'] as const) {
      await pickCartPriceUse(page, fx.use[key].name)
      await expect(page.getByTestId('type-terms')).toHaveCount(0)
      await expect(page.getByTestId('sixty-day-plan')).toHaveCount(0)
      await expect(page.getByTestId('typed-plan-note')).toContainText(
        `Typed terms are not available on ${fx.use[key].name}.`
      )
    }
    for (const key of ['REGULAR', 'OUT_OF_TOWN'] as const) {
      await pickCartPriceUse(page, fx.use[key].name)
      await expect(page.getByTestId('type-terms')).toBeVisible()
      await expect(page.getByTestId('sixty-day-plan')).toBeVisible()
    }
  })

  test('SP-F04: changing the price use switches the mode or clears the term, and says why', async ({
    page,
  }) => {
    await startSale(page, 'REGULAR')
    await expect(cashButton(page)).toBeEnabled()

    // cash → installment: the use is not sold for cash
    await pickCartPriceUse(page, fx.use.ZI.name)
    await expect(notice(page)).toContainText(
      `Switched to Installment: ${fx.use.ZI.name} is sold for installment or TPF only.`
    )
    await expect(page.getByTestId('installment-plan')).toBeVisible()

    // in-house → TPF: the use is sold for cash or TPF
    await pickCartPriceUse(page, fx.use.CASH.name)
    await expect(notice(page)).toContainText(
      `Switched to TPF: ${fx.use.CASH.name} is sold for cash or TPF only.`
    )
    await expect(tpfButton(page)).toBeVisible()

    // a term the new use does not allow is cleared
    await pickCartPriceUse(page, fx.use.REGULAR.name)
    await inhouseButton(page).click()
    await pickTerm(page, '12 months')
    const combo = page.getByTestId('installment-plan').getByRole('combobox').first()
    await expect(combo).toHaveAttribute('aria-label', '12 months')
    await pickCartPriceUse(page, fx.use.ZI.name)
    await expect(notice(page)).toContainText(
      `The 12-month term was cleared: ${fx.use.ZI.name} allows 3 months only.`
    )
    await expect(combo).toHaveAttribute('aria-label', 'Select a term…')

    // a typed plan is removed where the use does not allow one
    await pickCartPriceUse(page, fx.use.REGULAR.name)
    await page.getByTestId('type-terms').click()
    await expect(page.getByText('Use rate card values')).toBeVisible({ timeout: 10_000 })
    await pickCartPriceUse(page, fx.use.TERM.name)
    await expect(notice(page)).toContainText(
      `Typed terms were removed: ${fx.use.TERM.name} does not allow typed terms.`
    )
    await expect(page.getByText('Use rate card values')).toHaveCount(0)
  })

  test('SP-F05: two uses with no term in common show the note, offer TPF, and keep Pay disabled', async ({
    page,
  }) => {
    await startSale(page, 'TERM')
    await addItem(page, fx.itemNames[1])
    await pickCartPriceUse(page, fx.use.ZI.name, 1)
    await installmentButton(page).click()
    await expect(page.getByTestId('no-term-note')).toContainText(
      `The price uses on this sale have no installment term in common: ${fx.use.TERM.name} (6, 9 or 12 months), ${fx.use.ZI.name} (3 months). Sell them on TPF, or ring them as separate sales.`
    )
    await expect(page.getByTestId('things-left')).toHaveAttribute('title', /financing term/)
    // The way out the note names works: TPF is common to both.
    await tpfButton(page).click()
    await expect(page.getByTestId('no-term-note')).toHaveCount(0)
  })

  test('SP-F06: no active term for the months a use allows says who turns one on', async ({
    page,
    request,
  }) => {
    const terms = (await (await request.get('/api/pos/financing-terms')).json()) as {
      id: string
      termMonths: number
      isActive: boolean
    }[]
    const three = terms.filter((t) => t.termMonths === 3 && t.isActive)
    try {
      for (const t of three)
        await request.patch(`/api/pos/financing-terms/${t.id}`, { data: { isActive: false } })
      await startSale(page, 'ZI')
      await installmentButton(page).click()
      await expect(page.getByTestId('no-term-note')).toContainText(
        `${fx.use.ZI.name} allows 3 months only, but no active Financing Term has that length. Ask an admin to turn one on in POS Settings → Financing Terms.`
      )
    } finally {
      for (const t of three)
        await request.patch(`/api/pos/financing-terms/${t.id}`, { data: { isActive: true } })
    }
  })

  test('SP-F07: a 0% term on SPLIT REGULAR asks for a reason and a note, and names why', async ({
    page,
  }) => {
    await startSale(page, 'REGULAR')
    await installmentButton(page).click()
    await inhouseButton(page).click()
    await pickTerm(page, '5 months')
    await expect(exceptionSection(page)).toBeVisible()
    await expect(exceptionSection(page)).toContainText('0% Installment')
    await expect(page.getByTestId('zero-percent-note')).toContainText(
      `A 0% installment on ${fx.use.REGULAR.name} needs a reason and a note.`
    )
    await expect(page.getByTestId('things-left')).toHaveAttribute('title', /reason and note/)
  })

  test('SP-F08: an interest-bearing term shows no reason card', async ({ page }) => {
    await startSale(page, 'REGULAR')
    await installmentButton(page).click()
    await inhouseButton(page).click()
    await pickTerm(page, '6 months')
    await expect(exceptionSection(page)).toHaveCount(0)
    await expect(page.getByTestId('zero-percent-note')).toHaveCount(0)
  })

  test('SP-F09: a typed 0% plan shows one reason card, not two prompts', async ({ page }) => {
    await startSale(page, 'REGULAR')
    await installmentButton(page).click()
    await inhouseButton(page).click()
    await page.getByTestId('sixty-day-plan').click()
    await expect(page.getByTestId('typed-plan')).toBeVisible()
    await expect(exceptionSection(page)).toHaveCount(1)
    await expect(
      exceptionSection(page).getByRole('combobox', { name: 'Pick a reason…' })
    ).toHaveCount(1)
  })

  test('SP-F10: a cart on a use with no rules is unaffected', async ({ page }) => {
    await startSale(page, 'NO_RULES')
    await expect(cashButton(page)).toBeEnabled()
    await installmentButton(page).click()
    await expect(inhouseButton(page)).toBeEnabled()
    await expect(tpfButton(page)).toBeEnabled()
    await expect(page.getByTestId('type-terms')).toBeVisible()
    await expect(notice(page)).toHaveCount(0)
    await expect(page.getByTestId('no-term-note')).toHaveCount(0)
    await expect(page.getByTestId('no-payment-type-note')).toHaveCount(0)
    await pickTerm(page, '6 months')
    await expect(exceptionSection(page)).toHaveCount(0)
  })

  test('SP-F12: a typed plan over the use’s cap is called out in the panel, with the server’s wording', async ({
    page,
  }) => {
    await startSale(page, 'REGULAR')
    await installmentButton(page).click()
    await inhouseButton(page).click()
    await page.getByTestId('type-terms').click()
    const panel = page.getByTestId('typed-plan')
    const problem = page.getByTestId('typed-plan-problem')
    await panel.getByLabel('Typed months').fill('18')
    await expect(problem).toContainText(`${fx.use.REGULAR.name} allows terms up to 12 months.`)
    await panel.getByLabel('Typed months').fill('12')
    await expect(page.getByText('allows terms up to 12 months')).toHaveCount(0)
  })

  test('SP-F13: when only the server can tell a plan is 0% (monthlies with no down payment on the price row), its refusal opens the reason card', async ({
    page,
    request,
  }) => {
    // 6 × 1,800 is exactly the sale less the 10% down payment: 0% by the rate
    // card the posting uses, while the till previews it from the term's factor.
    const prices = await request.post(`/api/inventory/items/${fx.itemIds[0]}/prices`, {
      data: {
        prices: [
          {
            priceUse: fx.use.ODD_CARD.name,
            price: ITEM_PRICE,
            terms: [{ termMonths: 6, monthlyInstallment: 1800, ppd: 0 }],
          },
        ],
      },
    })
    expect(prices.ok(), await prices.text()).toBeTruthy()
    const approve = await request.post(
      `/api/inventory/price-lists/${fx.use.ODD_CARD.listId}/approve`,
      { data: {} }
    )
    expect(approve.ok(), await approve.text()).toBeTruthy()

    const { customer, applicationNumber } = await createApprovedApplication(
      page.request,
      'ODD_CARD'
    )
    await startSale(page, 'ODD_CARD')
    await selectCustomer(page, customer.name)
    await installmentButton(page).click()
    await inhouseButton(page).click()
    await pickApplication(page, applicationNumber)
    await pickTerm(page, '6 months')
    await expect(exceptionSection(page)).toHaveCount(0)

    const invoice = `SI-SPL-F13-${Date.now()}`
    await fillStable(page.getByLabel('Sales Invoice No.'), invoice)
    await page
      .getByTestId('dp-payment-mode-toggle')
      .getByRole('button', { name: 'Cash', exact: true })
      .click()
    await fillStable(page.getByLabel('Amount received'), '1200')
    await page.getByRole('button', { name: /Create Installment Plan/ }).click()

    // Refused by the server, and the till now offers where to answer it.
    await expect(exceptionSection(page)).toBeVisible({ timeout: 20_000 })
    await expect(exceptionSection(page)).toContainText('0% Installment')
    await fillReason(page, 'Split rules e2e card 0%')
    await page.getByRole('button', { name: /Create Installment Plan/ }).click()
    await expect(page.getByText('Installment Plan Created', { exact: true })).toBeVisible({
      timeout: 30_000,
    })
    const sale = await saleDetail(page, invoice)
    expect(sale.exceptionNote).toBe('Split rules e2e card 0%')
  })

  test('SP-F14: a sale invoicing a Delivery Receipt is cash only, so a use not sold for cash is explained, not switched', async ({
    page,
    request,
  }) => {
    const warehouses = (
      (await (await request.get('/api/inventory/warehouses?limit=200&status=active')).json())
        .data as { id: string; branchId: string | null }[]
    ).filter((w) => w.branchId === fx.branchId)
    const customer = await createCustomer(request, 'F14')
    const created = await request.post('/api/inventory/delivery-receipts', {
      data: {
        purpose: 'sales_invoice_to_follow',
        issueDate: new Date().toISOString().slice(0, 10),
        warehouseId: warehouses[0].id,
        customerId: customer.id,
        reason: `${PREFIX} DR sale`,
        lines: [{ itemId: fx.itemIds[0], quantity: 1 }],
      },
    })
    expect(created.ok(), await created.text()).toBeTruthy()
    const dr = await created.json()
    for (const step of ['submit', 'approve']) {
      const res = await request.post(`/api/inventory/delivery-receipts/${dr.id}/${step}`)
      expect(res.ok(), await res.text()).toBeTruthy()
    }
    try {
      await gotoReady(page, `/inventory/delivery-receipts/${dr.id}`)
      await page.getByRole('button', { name: 'Proceed to POS' }).click()
      await page.waitForURL(/\/pos\/checkout/, { timeout: 30_000 })
      await pickCheckoutSession(page, BRANCH)
      await expect(page.getByText(`Invoicing ${dr.drNumber}`, { exact: false })).toBeVisible({
        timeout: 45_000,
      })

      // Start from a use sold for cash, then move to one that is not.
      await pickCartPriceUse(page, fx.use.REGULAR.name)
      await page.getByTestId('payment-mode-cash').click()
      await pickCartPriceUse(page, fx.use.ZI.name)
      await expect(page.getByTestId('dr-cash-only-note')).toContainText(
        `${fx.use.ZI.name} is sold for installment or TPF only. A sale invoicing a Delivery Receipt is cash only — pick another price use for this item.`
      )
      await expect(page.getByTestId('installment-plan')).toHaveCount(0)
      await expect(page.getByText('Switched to Installment', { exact: false })).toHaveCount(0)

      // The way out the note names: a use that is sold for cash.
      await pickCartPriceUse(page, fx.use.REGULAR.name)
      await expect(page.getByTestId('dr-cash-only-note')).toHaveCount(0)
    } finally {
      await request.post(`/api/inventory/delivery-receipts/${dr.id}/void`, {
        data: { reason: 'E2E cleanup' },
      })
    }
  })

  test('SP-F15: on an X-Deal a term the price use forbids is still cleared and said, and a use not sold in-house says why', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'F15')
    await startSale(page, 'REGULAR')
    await selectCustomer(page, customer.name)
    await page.getByTestId('x-deal-checkbox').check()
    await pickTerm(page, '12 months')

    await pickCartPriceUse(page, fx.use.ZI.name)
    await expect(notice(page)).toContainText(
      `The 12-month term was cleared: ${fx.use.ZI.name} allows 3 months only.`
    )
    await expect(
      page.getByTestId('installment-plan').getByRole('combobox').first()
    ).toHaveAttribute('aria-label', 'Select a term…')

    await pickCartPriceUse(page, fx.use.CASH.name)
    await expect(page.getByTestId('x-deal-use-note')).toContainText(
      `${fx.use.CASH.name} is sold for cash or TPF only. An X-Deal is in-house installment only — pick another price use for this item.`
    )
    await pickCartPriceUse(page, fx.use.REGULAR.name)
    await expect(page.getByTestId('x-deal-use-note')).toHaveCount(0)
  })

  test('SP-F16: the notice about a switch or a cleared term goes once it no longer applies', async ({
    page,
  }) => {
    await startSale(page, 'REGULAR')
    await pickCartPriceUse(page, fx.use.ZI.name)
    await expect(notice(page)).toContainText('Switched to Installment')
    await pickCartPriceUse(page, fx.use.NO_RULES.name)
    await expect(notice(page)).toHaveCount(0)

    // A cleared term's notice goes when the cashier picks a term again.
    await pickCartPriceUse(page, fx.use.REGULAR.name)
    await installmentButton(page).click()
    await inhouseButton(page).click()
    await pickTerm(page, '12 months')
    await pickCartPriceUse(page, fx.use.ZI.name)
    await expect(notice(page)).toContainText('The 12-month term was cleared')
    await pickTerm(page, '3 months')
    await expect(notice(page)).toHaveCount(0)
  })

  // ───────────────────────────── journeys (J1–J9) ─────────────────────────────

  test('J1 / J4: a cash sale on SPLIT FREE INSTALL CASH and on SPLIT REGULAR posts with no reason and no override entry', async ({
    page,
  }) => {
    for (const [key, tag] of [
      ['CASH', 'J1'],
      ['REGULAR', 'J4'],
    ] as const) {
      const customer = await createCustomer(page.request, tag)
      await startSale(page, key)
      await selectCustomer(page, customer.name)
      await cashButton(page).click()
      const invoice = `SI-SPL-${tag}-${Date.now()}`
      await fillStable(page.getByLabel('Sales Invoice No.'), invoice)
      await fillStable(page.getByPlaceholder('0.00').first(), '20000')
      // Not clickStable — this submits a real sale.
      await page.getByRole('button', { name: /Confirm Sale/ }).click()
      await expect(page.getByText('Sale Complete', { exact: true })).toBeVisible({
        timeout: 20_000,
      })
      const sale = await saleDetail(page, invoice)
      expect(sale.lines[0].priceUseTypeId).toBe(fx.use[key].id)
      expect(sale.exceptionReasonId ?? null).toBeNull()
      await expect(await overrideEntryFor(page, invoice)).toHaveCount(0)
    }
  })

  test('J2 / J3 / J5: in-house installments post on the term each use allows — ZI 3 months, TERM 9 months, REGULAR 6 months with interest and no reason', async ({
    page,
  }) => {
    for (const [key, months, tag] of [
      ['ZI', '3 months', 'J2'],
      ['TERM', '9 months', 'J3'],
      ['REGULAR', '6 months', 'J5'],
    ] as const) {
      const invoice = await sellInstallment(page, key, months, tag)
      const sale = await saleDetail(page, invoice)
      expect(sale.lines[0].priceUseTypeId).toBe(fx.use[key].id)
      expect(sale.lines[0].financingTermId).not.toBeNull()
      expect(sale.exceptionReasonId ?? null).toBeNull()
      await expect(await overrideEntryFor(page, invoice)).toHaveCount(0)
    }
  })

  test('J6 / SP-F11: a 0% term on SPLIT OUT OF TOWN needs a reason and a note, and the Price Override Log shows it as "0% interest"', async ({
    page,
  }) => {
    const invoice = await sellInstallment(page, 'OUT_OF_TOWN', '5 months', 'J6', true)
    const sale = await saleDetail(page, invoice)
    expect(sale.exceptionNote).toBe('Split rules e2e 0%')
    expect(sale.exceptionReasonId).not.toBeNull()
    const entry = await overrideEntryFor(page, invoice)
    await expect(entry).toHaveCount(1, { timeout: 15_000 })
    await expect(entry).toContainText('0% interest')
    await openDetails(entry)
    await expect(entry.getByTestId('entry-details')).toContainText('Split rules e2e 0%')
  })

  test('J7: a typed 0% plan on SPLIT REGULAR takes one reason, and the log shows typed terms and "0% interest"', async ({
    page,
  }) => {
    const { customer, applicationNumber } = await createApprovedApplication(page.request, 'REGULAR')
    await startSale(page, 'REGULAR')
    await selectCustomer(page, customer.name)
    await installmentButton(page).click()
    await inhouseButton(page).click()
    await pickApplication(page, applicationNumber)
    await page.getByTestId('sixty-day-plan').click()
    await expect(page.getByTestId('typed-plan')).toBeVisible()
    await fillReason(page, 'Split rules e2e typed 0%')
    const invoice = `SI-SPL-J7-${Date.now()}`
    await payDownPayment(page, invoice)
    const entry = await overrideEntryFor(page, invoice)
    await expect(entry).toHaveCount(1, { timeout: 15_000 })
    // The row names the first flag and counts the rest; the details list both.
    await expect(entry).toContainText('Manual terms')
    await openDetails(entry)
    await expect(entry.getByTestId('entry-details')).toContainText('0% interest')
  })

  test('J8 / J9: TPF is the way through — on SPLIT FREE INSTALL CASH, and for a ZI + TERM cart that has no in-house term in common', async ({
    page,
  }) => {
    // J8
    const customerA = await createCustomer(page.request, 'J8')
    await startSale(page, 'CASH')
    await selectCustomer(page, customerA.name)
    await installmentButton(page).click()
    await tpfButton(page).click()
    const invoiceA = await finishTpf(page, 'J8')
    const saleA = await saleDetail(page, invoiceA)
    expect(saleA.lines[0].priceUseTypeId).toBe(fx.use.CASH.id)

    // J9: blocked in-house, then posted on TPF
    const customerB = await createCustomer(page.request, 'J9')
    await startSale(page, 'TERM')
    await addItem(page, fx.itemNames[1])
    await pickCartPriceUse(page, fx.use.ZI.name, 1)
    await selectCustomer(page, customerB.name)
    await installmentButton(page).click()
    await expect(page.getByTestId('no-term-note')).toBeVisible()
    await expect(page.getByTestId('things-left')).toHaveAttribute('title', /financing term/)
    await tpfButton(page).click()
    await expect(page.getByTestId('no-term-note')).toHaveCount(0)
    const invoiceB = await finishTpf(page, 'J9')
    const saleB = await saleDetail(page, invoiceB)
    expect(saleB.lines).toHaveLength(2)
  })
})
