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

// Docket #28 — "As a branch staff I want that the check out part is easy".
// This spec covers what that ticket added to the checkout:
//   • Freebie / Tie-up: a ₱0.00 line given with a sold item — tagged on the
//     cart row, tied to a sold item, never an override and never financed.
//   • An override names its unit: Brand, Type and Serial Number(s), in the
//     dialog, in the order summary and in the Price Override Log.
//   • The peso sign in front of the money inputs.
// Backend rules are covered by backend/src/pos/transactions.promo-tags.spec.ts.
//
// The seed's catalog is not sellable at a known price, so this spec builds its
// own items, priced on a Price Use + price list of its own, stocked at Bago.

const PREFIX = 'E2E Freebie'
const BRANCH = 'Bago'
const CORE_A_PRICE = 12000
const CORE_B_PRICE = 8000
const GIFT_PRICE = 500
const SERIAL_PRICE = 15000
// What each fixture unit costs, so a sale of it posts COGS.
const GIFT_COST = 300

type Item = { id: string; name: string }
type Fixtures = {
  coreA: Item
  coreB: Item
  gift: Item
  serialItem: Item & { serial: string; spare: string }
  brandName: string
  typeName: string
  brandId: string
  typeId: string
  priceUseTypeName: string
  priceUseTypeId: string
  priceListId: string
  branchId: string
  warehouseId: string
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

async function approveItem(request: APIRequestContext, id: string): Promise<void> {
  await request.post(`/api/inventory/items/${id}/submit`)
  await request.post(`/api/inventory/items/${id}/confirm-accounting`, { data: {} })
  await request.post(`/api/inventory/items/${id}/approve`, { data: {} })
}

async function createItem(
  request: APIRequestContext,
  baseUnitId: string,
  opts: {
    name: string
    price: number
    /** What the unit cost — so a sale of it posts COGS. */
    cost: number
    serial?: boolean
    brandId?: string
    typeId?: string
  }
): Promise<Item> {
  const res = await request.post('/api/inventory/items', {
    data: {
      sku: `E2E-FT-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      name: opts.name,
      baseUnitId,
      isSerialTracked: !!opts.serial,
      sellingPrice: opts.price,
      costPrice: opts.cost,
      ...(opts.brandId ? { brandId: opts.brandId } : {}),
      ...(opts.typeId ? { typeId: opts.typeId } : {}),
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const item = (await res.json()) as { id: string }
  await approveItem(request, item.id)
  return { id: item.id, name: opts.name }
}

async function stockItem(
  request: APIRequestContext,
  warehouseId: string,
  itemId: string,
  quantity: number
): Promise<void> {
  const adjustRes = await request.post('/api/inventory/adjustments', {
    data: {
      warehouseId,
      adjustmentDate: new Date().toLocaleDateString('en-CA'),
      reasonCode: 'found',
      notes: 'E2E freebie / tie-up fixture stock',
      lines: [{ itemId, expectedQty: 0, actualQty: quantity }],
    },
  })
  expect(adjustRes.ok(), await adjustRes.text()).toBeTruthy()
  const { id } = (await adjustRes.json()) as { id: string }
  for (const step of ['confirm', 'investigate', 'approve']) {
    const stepRes = await request.patch(`/api/inventory/adjustments/${id}/${step}`)
    expect(stepRes.ok(), await stepRes.text()).toBeTruthy()
  }
}

async function createFixtures(request: APIRequestContext): Promise<Fixtures> {
  const stamp = Date.now()
  const anyItemRes = await request.get('/api/inventory/items?limit=1')
  const baseUnitId = ((await anyItemRes.json()).data ?? [])[0].baseUnit.id as string

  const brandName = `${PREFIX} Brand ${stamp}`
  const brandRes = await request.post('/api/inventory/classification/brands', {
    data: { name: brandName },
  })
  expect(brandRes.ok(), await brandRes.text()).toBeTruthy()
  const brandId = ((await brandRes.json()) as { id: string }).id
  const typeName = `${PREFIX} Type ${stamp}`
  const typeRes = await request.post('/api/inventory/classification/types', {
    data: { name: typeName },
  })
  expect(typeRes.ok(), await typeRes.text()).toBeTruthy()
  const typeId = ((await typeRes.json()) as { id: string }).id

  const branches = ((await (await request.get('/api/branches?limit=200')).json()).data ?? []) as {
    id: string
    name: string
  }[]
  const branchId = branches.find((b) => b.name === BRANCH)!.id
  const warehouses = ((await (await request.get('/api/inventory/warehouses?limit=200')).json())
    .data ?? []) as { id: string; branchId: string | null }[]
  const warehouseId = warehouses.find((w) => w.branchId === branchId)!.id

  const coreA = await createItem(request, baseUnitId, {
    name: `${PREFIX} CoreA ${stamp}`,
    price: CORE_A_PRICE,
    cost: 7000,
  })
  const coreB = await createItem(request, baseUnitId, {
    name: `${PREFIX} CoreB ${stamp}`,
    price: CORE_B_PRICE,
    cost: 5000,
  })
  const gift = await createItem(request, baseUnitId, {
    name: `${PREFIX} Gift ${stamp}`,
    price: GIFT_PRICE,
    cost: GIFT_COST,
  })
  const serialBase = await createItem(request, baseUnitId, {
    name: `${PREFIX} Serial ${stamp}`,
    price: SERIAL_PRICE,
    cost: 9000,
    serial: true,
    brandId,
    typeId,
  })
  for (const item of [coreA, coreB, gift]) await stockItem(request, warehouseId, item.id, 30)
  // FT-04 sells the first serial; FT-08 only carts the spare, so the two do not
  // depend on the order they run in.
  const serial = `${PREFIX.replace(/ /g, '-')}-SN-${stamp}`
  const spare = `${serial}-B`
  const serialRes = await request.post('/api/inventory/serial-numbers', {
    data: { itemId: serialBase.id, warehouseId, serialNumbers: [serial, spare] },
  })
  expect(serialRes.ok(), await serialRes.text()).toBeTruthy()

  const priceUseTypeName = `${PREFIX} PU ${stamp}`
  const putRes = await request.post('/api/inventory/price-use-types', {
    data: { name: priceUseTypeName },
  })
  expect(putRes.ok(), await putRes.text()).toBeTruthy()
  const priceUseType = (await putRes.json()) as { id: string }
  const listRes = await request.post('/api/inventory/price-lists', {
    data: { name: `${PREFIX} List ${stamp}`, priceUseTypeId: priceUseType.id },
  })
  expect(listRes.ok(), await listRes.text()).toBeTruthy()
  const priceList = (await listRes.json()) as { id: string }
  const itemsRes = await request.post(`/api/inventory/price-lists/${priceList.id}/items`, {
    data: {
      items: [
        { itemId: coreA.id, price: CORE_A_PRICE },
        { itemId: coreB.id, price: CORE_B_PRICE },
        { itemId: gift.id, price: GIFT_PRICE },
        { itemId: serialBase.id, price: SERIAL_PRICE },
      ],
    },
  })
  expect(itemsRes.ok(), await itemsRes.text()).toBeTruthy()
  const approveRes = await request.post(`/api/inventory/price-lists/${priceList.id}/approve`, {
    data: {},
  })
  expect(approveRes.ok(), await approveRes.text()).toBeTruthy()

  return {
    coreA,
    coreB,
    gift,
    serialItem: { ...serialBase, serial, spare },
    brandName,
    typeName,
    brandId,
    typeId,
    priceUseTypeName,
    priceUseTypeId: priceUseType.id,
    priceListId: priceList.id,
    branchId,
    warehouseId,
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
  const customer = (await res.json()) as { id: string }
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
  // expected amount, so a rerun would otherwise fail.
  if (open.length) return
  await request.post('/api/pos/sessions/open', {
    data: { terminalId: terminal.id, openingCash: 1000 },
  })
}

/** On-hand quantity of an item in Bago's warehouse (serial items count serials). */
async function onHand(request: APIRequestContext, itemId: string): Promise<number> {
  const res = await request.get('/api/inventory/stock/balances', {
    params: { itemId, warehouseId: fx.warehouseId, limit: 5 },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const body = await res.json()
  const row = ((body.data ?? body) as Record<string, unknown>[])[0]
  if (!row) return 0
  return Number(row.onHandQty ?? 0)
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

/** Adds an item to the cart and puts its row on the fixture Price Use.
 * `rowIndex` is the row's place in the cart (0 = first), which is where its
 * Price Use picker sits. */
async function addItem(page: Page, item: Item, rowIndex: number, serial?: string): Promise<void> {
  const search = page.getByPlaceholder('Search by name or serial')
  await expect(search).toBeVisible({ timeout: 15_000 })
  await search.fill(item.name)
  const card = page.getByRole('button').filter({ has: page.getByText(item.name, { exact: true }) })
  await expect(card.first()).toBeVisible({ timeout: 15_000 })
  await card.first().click()
  if (serial) {
    await expect(page.getByRole('heading', { name: 'Select Serial Number' })).toBeVisible({
      timeout: 10_000,
    })
    await page
      .getByRole('button', { name: new RegExp(serial) })
      .first()
      .click()
    await expect(page.getByRole('heading', { name: 'Select Serial Number' })).toHaveCount(0)
  }
  await pickCartPriceUse(page, fx.priceUseTypeName, rowIndex)
  await expect(
    row(page, item)
      .getByText(/₱[\d,]+\.\d{2}/)
      .first()
  ).toBeVisible({ timeout: 10_000 })
}

async function selectCustomer(page: Page, name: string): Promise<void> {
  const input = page.getByPlaceholder('Search by name or phone…')
  await input.click()
  await fillStable(input, name)
  await page.getByRole('button', { name: new RegExp(name) }).click()
}

// `.first()`: a tagged row also spells out the sold item it "Goes with", so a
// sold item's name can match that row too — its own row comes first in the cart.
const row = (page: Page, item: Item) => page.locator('tr', { hasText: item.name }).first()
const exceptionSection = (page: Page) => page.getByTestId('price-override-exception')

/** The charged price of a cart row — the last money amount in it. */
async function rowPrice(page: Page, item: Item): Promise<string> {
  const text = (await row(page, item).textContent()) ?? ''
  return text.match(/₱[\d,]+\.\d{2}/g)?.at(-1) ?? ''
}

async function readSale(page: Page, customerId: string, salesInvoiceNumber: string) {
  const listRes = await page.request.get('/api/pos/transactions', { params: { customerId } })
  const body = await listRes.json()
  const sale = ((body.data ?? body) as { id: string; salesInvoiceNumber: string | null }[]).find(
    (t) => t.salesInvoiceNumber === salesInvoiceNumber
  )!
  expect(sale, `sale ${salesInvoiceNumber} not found`).toBeTruthy()
  return (await page.request.get(`/api/pos/transactions/${sale.id}`)).json()
}

type SaleLine = {
  itemId: string
  unitPrice: string | number
  lineTotal: string | number
  promoTag: string | null
  tiedToItemId: string | null
  priceOverrideBy: string | null
  invoiceType: string
  unitCost: string | number | null
}

test.describe('POS Checkout — freebie / tie-up, unit details, ₱ (Docket #28)', () => {
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
      for (const id of [fx.coreA.id, fx.coreB.id, fx.gift.id, fx.serialItem.id]) {
        await request.delete(`/api/inventory/items/${id}`).catch(() => {})
      }
      await request.delete(`/api/inventory/classification/brands/${fx.brandId}`).catch(() => {})
      await request.delete(`/api/inventory/classification/types/${fx.typeId}`).catch(() => {})
    }
    await request.dispose()
  })

  test('FT-01: Freebie / Tie-up need a sold item; ticking one makes the row ₱0.00, tied to it, with no override reason', async ({
    page,
  }) => {
    await openCheckout(page)
    await addItem(page, fx.coreA, 0)

    // One item alone has nothing to go with: both boxes are off.
    const alone = row(page, fx.coreA)
    await expect(alone.getByTestId('tag-freebie')).toBeDisabled()
    await expect(alone.getByTestId('tag-tie_up')).toBeDisabled()

    await addItem(page, fx.gift, 1)
    const gift = row(page, fx.gift)
    await expect(gift.getByTestId('tag-freebie')).toBeEnabled()
    const listPrice = await rowPrice(page, fx.gift)
    expect(listPrice).toBe('₱500.00')

    await gift.getByTestId('tag-freebie').check()
    await expect(gift.getByTestId('promo-badge')).toHaveText('Freebie')
    await expect.poll(() => rowPrice(page, fx.gift)).toBe('₱0.00')
    // It is tied to the sold item, which is named — and it is not an override.
    await expect(gift.getByTestId('promo-tied-to')).toContainText(fx.coreA.name)
    await expect(gift.getByRole('button', { name: 'Override price' })).toHaveCount(0)
    await expect(exceptionSection(page)).toHaveCount(0)
    // The sold row is untouched, and it is not asked about being tied to anything.
    await expect(row(page, fx.coreA).getByTestId('promo-badge')).toHaveCount(0)
    await expect.poll(() => rowPrice(page, fx.coreA)).toBe('₱12,000.00')

    // One tag at a time: Tie-up replaces Freebie.
    await gift.getByTestId('tag-tie_up').check()
    await expect(gift.getByTestId('promo-badge')).toHaveText('Tie-up')
    await expect(gift.getByTestId('tag-freebie')).not.toBeChecked()

    // Unticking puts it back on its price-list price and on Override price.
    await gift.getByTestId('tag-tie_up').uncheck()
    await expect(gift.getByTestId('promo-badge')).toHaveCount(0)
    await expect.poll(() => rowPrice(page, fx.gift)).toBe(listPrice)
    await expect(gift.getByRole('button', { name: 'Override price' })).toBeVisible()
  })

  test('FT-02: with two sold items a tie-up names the one it goes with, and the posted sale keeps the tag, the tie and ₱0 — stock goes out', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'FT02')
    const giftBefore = await onHand(page.request, fx.gift.id)
    const coreBBefore = await onHand(page.request, fx.coreB.id)

    await openCheckout(page)
    await addItem(page, fx.coreA, 0)
    await addItem(page, fx.coreB, 1)
    await addItem(page, fx.gift, 2)
    await selectCustomer(page, customer.name)

    const gift = row(page, fx.gift)
    await gift.getByTestId('tag-tie_up').check()
    await expect(gift.getByTestId('promo-badge')).toHaveText('Tie-up')
    // Two sold items: a picker, starting on the first.
    const tiedTo = gift.getByTestId('promo-tied-to')
    await expect(tiedTo.getByRole('combobox')).toBeVisible()
    await expect(tiedTo).toContainText(fx.coreA.name)
    await openCustomSelect(tiedTo.getByRole('combobox'))
    await page.getByRole('option', { name: fx.coreB.name, exact: true }).click()
    await expect(tiedTo).toContainText(fx.coreB.name)

    const salesInvoiceNumber = `SI-FT02-${Date.now()}`
    await fillStable(page.getByLabel('Sales Invoice No.'), salesInvoiceNumber)
    await fillStable(page.getByPlaceholder('0.00').first(), '100000')
    // Not clickStable — this submits a real sale.
    await page.getByRole('button', { name: /Confirm Sale/ }).click()
    await expect(page.getByText('Sale Complete', { exact: true })).toBeVisible({ timeout: 20_000 })

    const sale = await readSale(page, customer.id, salesInvoiceNumber)
    // The sale is the two sold items only — the tie-up earns nothing.
    expect(Number(sale.totalAmount)).toBe(CORE_A_PRICE + CORE_B_PRICE)
    const lines = sale.lines as SaleLine[]
    const tagged = lines.find((l) => l.itemId === fx.gift.id)!
    expect(tagged.promoTag).toBe('tie_up')
    expect(tagged.tiedToItemId).toBe(fx.coreB.id)
    expect(Number(tagged.unitPrice)).toBe(0)
    expect(Number(tagged.lineTotal)).toBe(0)
    // Not an override: nobody applied one, so there is nothing for the log.
    expect(tagged.priceOverrideBy).toBeNull()
    // It earns nothing but it still costs something: the line keeps its unit cost.
    expect(Number(tagged.unitCost)).toBe(GIFT_COST)
    // … and the cost posts: Dr Cost of Sales / Cr Inventory for the freebie, and
    // no Sales credit, since it earned nothing.
    const entry = await (
      await page.request.get(`/api/journal-entries/${sale.journalEntryId}`)
    ).json()
    const giftEntries = (
      entry.transactions as {
        itemId: string | null
        debit: string | number
        credit: string | number
        account: { name: string }
      }[]
    ).filter((l) => l.itemId === fx.gift.id)
    const total = (accountName: RegExp, side: 'debit' | 'credit') =>
      giftEntries
        .filter((l) => accountName.test(l.account.name))
        .reduce((sum, l) => sum + Number(l[side]), 0)
    expect(total(/Cost of Sales/, 'debit')).toBe(GIFT_COST)
    expect(total(/Inventory/, 'credit')).toBe(GIFT_COST)
    expect(total(/^Sales/, 'credit')).toBe(0)
    for (const sold of lines.filter((l) => l.itemId !== fx.gift.id)) {
      expect(sold.promoTag).toBeNull()
      expect(sold.tiedToItemId).toBeNull()
    }
    // Its stock went out like any line's.
    expect(await onHand(page.request, fx.gift.id)).toBe(giftBefore - 1)
    expect(await onHand(page.request, fx.coreB.id)).toBe(coreBBefore - 1)
  })

  test('FT-03: in Installment mode a freebie stays cash, and the sale still posts', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'FT03')
    await openCheckout(page)
    await addItem(page, fx.coreA, 0)
    await addItem(page, fx.gift, 1)
    await selectCustomer(page, customer.name)
    await page.getByRole('button', { name: 'Installment', exact: true }).click()
    await expect(page.getByRole('combobox', { name: 'Select a term…' })).toBeVisible({
      timeout: 10_000,
    })

    const gift = row(page, fx.gift)
    await gift.getByTestId('tag-freebie').check()
    await expect(gift.getByTestId('promo-badge')).toHaveText('Freebie')
    // The freebie takes no term — only the sold row has a picker …
    await expect(page.getByRole('combobox', { name: 'Select a term…' })).toHaveCount(1)
    // … and flipping the sale to Cash and back to Installment leaves it that way.
    await page.getByRole('button', { name: 'Cash', exact: true }).first().click()
    await page.getByRole('button', { name: 'Installment', exact: true }).click()
    await expect(page.getByRole('combobox', { name: 'Select a term…' })).toHaveCount(1)
    await expect.poll(() => rowPrice(page, fx.gift)).toBe('₱0.00')

    // Post it the way the waiver spec does: waive the application, pick a term.
    const salesInvoiceNumber = `SI-FT03-${Date.now()}`
    await page.getByTestId('credit-waiver-checkbox').check()
    await openCustomSelect(page.getByRole('combobox', { name: 'Select a term…' }))
    await page.getByRole('listbox').getByRole('option').first().click()
    const section = exceptionSection(page)
    await openCustomSelect(section.getByRole('combobox', { name: 'Pick a reason…' }))
    await page.getByRole('listbox').getByRole('option', { name: 'Management special' }).click()
    await fillStable(section.getByLabel('Note for the price override or typed terms'), 'FT-03')
    await fillStable(page.getByLabel('Sales Invoice No.'), salesInvoiceNumber)
    await page
      .getByTestId('dp-payment-mode-toggle')
      .getByRole('button', { name: 'Cash', exact: true })
      .click()
    // The down payment's Amount received offers "Use exact" too: it fills the
    // down payment, not the sale total.
    const useExact = page.getByTestId('payment-use-exact-0')
    await expect(useExact).toHaveText(/^Use exact ₱[\d,]+\.\d{2}$/)
    const exactText = (await useExact.textContent()) ?? ''
    const exactAmount = Number(exactText.replace(/[^\d.]/g, ''))
    expect(exactAmount).toBeGreaterThan(0)
    expect(exactAmount).toBeLessThan(CORE_A_PRICE)
    await useExact.click()
    await expect(page.getByTestId('payment-amount-0')).toHaveValue(String(exactAmount))
    await fillStable(page.getByPlaceholder('CR Number'), `CR-FT03-${Date.now()}`)
    // With a cash freebie beside the installment row the cart is mixed, so the
    // button reads Confirm Sale rather than Create Installment Plan.
    await page.getByRole('button', { name: /Confirm Sale|Create Installment Plan/ }).click()
    await expect(page.getByText(/Sale Complete|Installment Plan Created/).first()).toBeVisible({
      timeout: 45_000,
    })

    const lines = (await readSale(page, customer.id, salesInvoiceNumber)).lines as SaleLine[]
    const tagged = lines.find((l) => l.itemId === fx.gift.id)!
    expect(tagged.promoTag).toBe('freebie')
    expect(tagged.invoiceType).toBe('cash')
    expect(Number(tagged.unitPrice)).toBe(0)
    expect(lines.find((l) => l.itemId === fx.coreA.id)!.invoiceType).toBe('installment')
  })

  test('FT-04: an override names the unit — Brand, Type and Serial — in the dialog, the order summary and the Price Override Log', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'FT04')
    await openCheckout(page)
    await addItem(page, fx.serialItem, 0, fx.serialItem.serial)
    await selectCustomer(page, customer.name)

    const serialRow = row(page, fx.serialItem)
    await serialRow.getByRole('button', { name: 'Override price' }).click()
    await expect(page.getByRole('heading', { name: 'Price Override' })).toBeVisible()
    const dialogUnit = page.getByTestId('override-unit-details')
    await expect(dialogUnit).toContainText(fx.brandName)
    await expect(dialogUnit).toContainText(fx.typeName)
    await expect(dialogUnit).toContainText(fx.serialItem.serial)
    await page.getByLabel('New unit price').fill('14000')
    await page.getByRole('button', { name: 'Apply Override' }).click()
    await expect(page.getByRole('heading', { name: 'Price Override' })).toHaveCount(0)

    const section = exceptionSection(page)
    await expect(section).toBeVisible()
    const summaryUnit = section.getByTestId('override-unit')
    await expect(summaryUnit).toContainText(fx.serialItem.name)
    await expect(summaryUnit).toContainText(fx.brandName)
    await expect(summaryUnit).toContainText(fx.typeName)
    await expect(summaryUnit).toContainText(fx.serialItem.serial)

    await openCustomSelect(section.getByRole('combobox', { name: 'Pick a reason…' }))
    await page.getByRole('listbox').getByRole('option', { name: 'Management special' }).click()
    await fillStable(section.getByLabel('Note for the price override'), 'FT-04 unit details')
    const salesInvoiceNumber = `SI-FT04-${Date.now()}`
    await fillStable(page.getByLabel('Sales Invoice No.'), salesInvoiceNumber)
    await fillStable(page.getByPlaceholder('0.00').first(), '100000')
    // A cart with a serial-tracked item labels its button Checkout, not Confirm Sale.
    await page
      .getByTestId('checkout-footer')
      .getByRole('button', { name: /^(Confirm Sale|Checkout)$/ })
      .click()
    await expect(page.getByText('Sale Complete', { exact: true })).toBeVisible({ timeout: 20_000 })

    // The Price Override Log's detail names the unit as well.
    await gotoReady(page, `/pos/override-review?branchId=${fx.branchId}`)
    const entry = page.getByTestId('override-entry').filter({ hasText: salesInvoiceNumber })
    await expect(entry).toBeVisible({ timeout: 20_000 })
    await entry.getByTestId('entry-toggle').click()
    const details = entry.getByTestId('entry-details')
    await expect(details).toBeVisible()
    await expect(details.getByTestId('entry-brand')).toContainText(fx.brandName)
    await expect(details.getByTestId('entry-type')).toContainText(fx.typeName)
    await expect(details.getByTestId('entry-serial')).toContainText(fx.serialItem.serial)
  })

  test('FT-05: the money inputs carry a peso sign — the down payment, the typed terms and a reserve deposit', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'FT05')
    await openCheckout(page)
    await addItem(page, fx.coreA, 0)
    await selectCustomer(page, customer.name)
    await page.getByRole('button', { name: 'Installment', exact: true }).click()
    await expect(page.getByRole('combobox', { name: 'Select a term…' })).toBeVisible({
      timeout: 10_000,
    })

    // Typed terms: the down payment and the monthly installment (not Months).
    await page.getByTestId('type-terms').click()
    const typed = page.getByTestId('typed-plan')
    await expect(typed).toBeVisible()
    for (const label of ['Typed down payment', 'Typed monthly installment']) {
      await expect(typed.getByLabel(label).locator('xpath=..')).toContainText('₱')
    }
    await expect(typed.getByLabel('Typed months').locator('xpath=..')).not.toContainText('₱')

    // The reserve deposit row.
    await page.getByRole('button', { name: /^Reserve/ }).click()
    await page.getByRole('button', { name: /Add deposit \(optional\)/ }).click()
    const deposit = page.getByPlaceholder('0.00').first()
    await expect(deposit).toBeVisible()
    await expect(deposit.locator('xpath=..')).toContainText('₱')
  })

  test('FT-06: the down payment field carries a peso sign', async ({ page }) => {
    const customer = await createCustomer(page.request, 'FT06')
    await openCheckout(page)
    await addItem(page, fx.coreA, 0)
    await selectCustomer(page, customer.name)
    await page.getByRole('button', { name: 'Installment', exact: true }).click()
    await expect(page.getByRole('combobox', { name: 'Select a term…' })).toBeVisible({
      timeout: 10_000,
    })
    await openCustomSelect(page.getByRole('combobox', { name: 'Select a term…' }))
    await page.getByRole('listbox').getByRole('option').first().click()
    const down = page.getByTestId('down-payment-input').first()
    await expect(down).toBeVisible()
    await expect(down.locator('xpath=..')).toContainText('₱')
  })
  test('FT-07: "Use exact" fills Amount received and flips the status; with two payments the second row\'s exact is what remains', async ({
    page,
  }) => {
    await openCheckout(page)
    await addItem(page, fx.coreA, 0)

    // Nothing paid yet: red, with what is still to collect.
    const status = page.getByTestId('collection-status')
    await expect(status).toHaveText(`Still to collect ₱${CORE_A_PRICE.toLocaleString('en-PH')}.00`)
    await expect(status).toHaveClass(/text-red-600/)

    // One tap fills the field with exactly what settles the sale, and turns green.
    const exact = page.getByTestId('payment-use-exact-0')
    await expect(exact).toHaveText(`Use exact ₱${CORE_A_PRICE.toLocaleString('en-PH')}.00`)
    await exact.click()
    await expect(page.getByTestId('payment-amount-0')).toHaveValue(String(CORE_A_PRICE))
    await expect(status).toHaveText('Fully collected')
    await expect(status).toHaveClass(/text-green-700/)

    // A part payment shows what remains.
    await fillStable(page.getByTestId('payment-amount-0'), '5000')
    await expect(status).toHaveText('Still to collect ₱7,000.00')

    // A second payment row: its exact is the remainder after the first row, and
    // the single-payment status gives way to the Paid so far / Remaining summary.
    await page.getByTestId('add-another-payment').click()
    await expect(page.getByTestId('payment-row-1')).toBeVisible()
    await expect(page.getByTestId('collection-status')).toHaveCount(0)
    await expect(page.getByTestId('payment-use-exact-1')).toHaveText('Use exact ₱7,000.00')
    await page.getByTestId('payment-use-exact-1').click()
    await expect(page.getByTestId('payment-amount-1')).toHaveValue('7000')
    await expect(page.getByTestId('payment-paid-so-far')).toHaveText('₱12,000.00')
    await expect(page.getByTestId('payment-remaining')).toHaveText('₱0.00')
    // …and the first row's exact is now what it would have to be given the second.
    await expect(page.getByTestId('payment-use-exact-0')).toHaveText('Use exact ₱5,000.00')
  })

  test('FT-08: the Items card counts items and units, badges overrides, and searches the cart by name and by serial', async ({
    page,
  }) => {
    await openCheckout(page)
    await addItem(page, fx.coreA, 0)
    const count = page.getByTestId('cart-count')
    await expect(count).toHaveText('1 item · 1 unit')
    // No override yet: no badge.
    await expect(page.getByTestId('cart-overridden-count')).toHaveCount(0)

    // A second unit of the same item adds a unit, not an item.
    await row(page, fx.coreA).getByRole('button', { name: 'Increase quantity' }).click()
    await expect(count).toHaveText('1 item · 2 units')
    await addItem(page, fx.serialItem, 1, fx.serialItem.spare)
    await expect(count).toHaveText('2 items · 3 units')

    // One override: the badge counts it.
    await row(page, fx.serialItem).getByRole('button', { name: 'Override price' }).click()
    await page.getByLabel('New unit price').fill('14000')
    await page.getByRole('button', { name: 'Apply Override' }).click()
    await expect(page.getByRole('heading', { name: 'Price Override' })).toHaveCount(0)
    await expect(page.getByTestId('cart-overridden-count')).toHaveText('1 overridden · for review')

    // The hint under the list says freebies and tie-ups are ₱0.00.
    await expect(page.getByTestId('cart-scroll-hint')).toContainText(
      'Freebie and Tie-up lines are priced at ₱0.00.'
    )

    // Search by name narrows the rows …
    const search = page.getByTestId('cart-search')
    await fillStable(search, 'CoreA')
    await expect(row(page, fx.coreA)).toBeVisible()
    await expect(row(page, fx.serialItem)).toHaveCount(0)
    await expect(page.getByTestId('cart-search-empty')).toHaveCount(0)
    // … so does a serial number …
    await fillStable(search, fx.serialItem.spare)
    await expect(row(page, fx.serialItem)).toBeVisible()
    await expect(row(page, fx.coreA)).toHaveCount(0)
    // … and by the brand the row carries.
    await fillStable(search, fx.brandName)
    await expect(row(page, fx.serialItem)).toBeVisible()
    await expect(row(page, fx.coreA)).toHaveCount(0)
    // No match: an empty state that names the search. The counts do not change.
    await fillStable(search, 'no-such-line-zzz')
    await expect(page.getByTestId('cart-search-empty')).toContainText('no-such-line-zzz')
    await expect(count).toHaveText('2 items · 3 units')
    // Clearing the search brings every row back.
    await fillStable(search, '')
    await expect(row(page, fx.coreA)).toBeVisible()
    await expect(row(page, fx.serialItem)).toBeVisible()
    await expect(page.getByTestId('cart-search-empty')).toHaveCount(0)
  })

  test('FT-09: the footer note reads cash vs installment, and "N things left" counts what is missing and goes away at zero', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'FT09')
    await openCheckout(page)
    await addItem(page, fx.coreA, 0)
    const left = page.getByTestId('things-left')
    const note = page.getByTestId('confirm-total-note')

    // A cash sale with an override and nothing else filled in: the document
    // number, the customer, the payment — and the reason and note, as ONE thing.
    await row(page, fx.coreA).getByRole('button', { name: 'Override price' }).click()
    await page.getByLabel('New unit price').fill('10000')
    await page.getByRole('button', { name: 'Apply Override' }).click()
    await expect(page.getByRole('heading', { name: 'Price Override' })).toHaveCount(0)
    await expect(left).toHaveText('4 things left')
    await expect(left).toHaveAttribute(
      'title',
      'Still needed: document number, customer, payment, reason and note'
    )
    await expect(note).toHaveText('Full payment')

    await selectCustomer(page, customer.name)
    await expect(left).toHaveText('3 things left')
    await fillStable(page.getByLabel('Sales Invoice No.'), `SI-FT09-${Date.now()}`)
    await expect(left).toHaveText('2 things left')

    // Delivery turned on with nothing filled in is one more thing — and with a
    // fee, the footer note says the total includes it.
    await page.getByText('For delivery', { exact: true }).click()
    await expect(left).toHaveText('3 things left')
    await expect(left).toHaveAttribute('title', /delivery details/)
    await fillStable(page.locator('#delivery-fee'), '150')
    await expect(note).toHaveText('Full payment incl. delivery')
    await page.getByText('For delivery', { exact: true }).click()
    await expect(left).toHaveText('2 things left')
    await expect(note).toHaveText('Full payment')

    // The reason and its note settle together, as one thing.
    const section = exceptionSection(page)
    await openCustomSelect(section.getByRole('combobox', { name: 'Pick a reason…' }))
    await page.getByRole('listbox').getByRole('option', { name: 'Management special' }).click()
    await expect(left).toHaveText('2 things left')
    await fillStable(section.getByLabel('Note for the price override'), 'FT-09')
    await expect(left).toHaveText('1 thing left')

    // Paying it settles the last one, and the line goes away.
    await page.getByTestId('payment-use-exact-0').click()
    await expect(left).toHaveCount(0)

    // Installment: the note gives the down payment and the sale total, and a
    // financing term still to pick is one of the things left.
    await page.getByRole('button', { name: 'Installment', exact: true }).click()
    await expect(note).toHaveText(/^Down payment · sale total ₱10,000\.00$/)
    await expect(left).toHaveAttribute('title', /financing term/)
    await page.getByText('For delivery', { exact: true }).click()
    await fillStable(page.locator('#delivery-fee'), '150')
    await expect(note).toHaveText(/^Down payment \+ delivery · sale total ₱10,000\.00$/)
  })
})
