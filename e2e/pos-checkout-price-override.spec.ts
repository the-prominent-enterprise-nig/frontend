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

// Scenario 71 Part 1 — a price override at POS checkout needs no manager and
// no PIN: the cashier types the price, picks a reason and writes a note, and
// the sale keeps all three (plus the list price it started from) for the
// end-of-day review. The backend rules are covered by
// backend/test/pos-price-use.e2e-spec.ts; this spec covers the checkout UI
// that drives them and checks what the posted sale kept. Case IDs (PO-F…)
// match docs/scenario-71-price-override-end-of-day-review-plan.md.
//
// The seed leaves nothing sellable that also has a price, so this spec builds
// its own: a fresh non-serial item, stocked at Bago, priced on a dedicated
// Price Use + price list of its own (never the shared WIP list).

const PREFIX = 'E2E PriceOverride'
const BRANCH = 'Bago'
const ITEM_PRICE = 12000
const OVERRIDE_PRICE = 10000

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

const cartRow = (page: Page) => page.locator('tr', { hasText: fx.itemName })
const exceptionSection = (page: Page) => page.getByTestId('price-override-exception')

/** The charged price of the cart row — the last money amount in it. An
 * overridden row also shows its list price struck through above the charged
 * one, so "the last" is the charged figure whether or not it is overridden. */
async function rowPrice(page: Page): Promise<string> {
  const text = (await cartRow(page).textContent()) ?? ''
  return text.match(/₱[\d,]+\.\d{2}/g)?.at(-1) ?? ''
}

async function applyOverride(page: Page, price: number): Promise<void> {
  await cartRow(page).getByRole('button', { name: 'Override price' }).click()
  await expect(page.getByRole('heading', { name: 'Price Override' })).toBeVisible()
  await page.getByLabel('New unit price').fill(String(price))
  await page.getByRole('button', { name: 'Apply Override' }).click()
  await expect(page.getByRole('heading', { name: 'Price Override' })).toHaveCount(0)
}

test.describe('POS Checkout — price override without a manager (Scenario 71 Part 1)', () => {
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

  test('PO-F01: every priced line offers "Override price", and the dialog asks for a price and nothing else — no manager PIN', async ({
    page,
  }) => {
    await openCheckout(page)
    await addItem(page)
    await expect(
      cartRow(page)
        .getByText(/₱[\d,]+\.\d{2}/)
        .first()
    ).toBeVisible({ timeout: 10_000 })

    await cartRow(page).getByRole('button', { name: 'Override price' }).click()
    await expect(page.getByRole('heading', { name: 'Price Override' })).toBeVisible()
    await expect(page.getByText('New Unit Price (₱)')).toBeVisible()
    await expect(page.getByText('List price ₱12,000.00')).toBeVisible()
    await expect(page.getByText('Manager PIN')).toHaveCount(0)
    await expect(page.getByText('Manager User ID')).toHaveCount(0)

    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Price Override' })).toHaveCount(0)
    // Cancelling must not fabricate an override.
    await expect(cartRow(page).getByText('Overridden')).toHaveCount(0)
    await expect(exceptionSection(page)).toHaveCount(0)
  })

  test('PO-F02: applying an override changes the price, marks the line Overridden and asks for a reason and a note once', async ({
    page,
  }) => {
    await openCheckout(page)
    await addItem(page)
    await expect(
      cartRow(page)
        .getByText(/₱[\d,]+\.\d{2}/)
        .first()
    ).toBeVisible({ timeout: 10_000 })
    const listPrice = await rowPrice(page)

    await applyOverride(page, OVERRIDE_PRICE)

    // The row reads: list price struck through, the charged price, a badge,
    // and Change / Clear / Remove as text buttons under the Price Use.
    await expect(cartRow(page).getByTestId('override-badge')).toHaveText('Overridden · for review')
    await expect(cartRow(page).getByTestId('override-list-price')).toHaveText(listPrice)
    await expect(cartRow(page).getByRole('button', { name: 'Change override' })).toBeVisible()
    await expect(cartRow(page).getByRole('button', { name: 'Clear override' })).toBeVisible()
    await expect(cartRow(page).getByRole('button', { name: 'Remove item' })).toBeVisible()
    expect(await rowPrice(page)).not.toBe(listPrice)

    const section = exceptionSection(page)
    await expect(section).toBeVisible()
    await expect(section).toContainText('No approval needed')
    // The business's own reasons — the starter list on a fresh tenant.
    await openCustomSelect(section.getByRole('combobox', { name: 'Pick a reason…' }))
    const options = page.getByRole('listbox').getByRole('option')
    await expect(options.filter({ hasText: 'Loyal customer' })).toBeVisible()
    await expect(options.filter({ hasText: 'Management special' })).toBeVisible()
  })

  test('PO-F03: Confirm is refused until a reason and a note are given, and nothing is sent', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'F03')
    await openCheckout(page)
    await addItem(page)
    await selectCustomer(page, customer.name)
    await applyOverride(page, OVERRIDE_PRICE)
    await fillStable(page.getByLabel('Sales Invoice No.'), `SI-PO71-F03-${Date.now()}`)
    await fillStable(page.getByPlaceholder('0.00').first(), '100000')

    await page.getByRole('button', { name: /Confirm Sale/ }).click()
    await expect(page.getByText('Pick a reason for the price override.')).toBeVisible()

    const section = exceptionSection(page)
    await openCustomSelect(section.getByRole('combobox', { name: 'Pick a reason…' }))
    await page.getByRole('listbox').getByRole('option', { name: 'Bulk deal' }).click()

    await page.getByRole('button', { name: /Confirm Sale/ }).click()
    await expect(page.getByText('Add a note for the price override.')).toBeVisible()

    await fillStable(section.getByLabel('Note for the price override'), '   ')
    await page.getByRole('button', { name: /Confirm Sale/ }).click()
    await expect(page.getByText('Add a note for the price override.')).toBeVisible()
    await expect(page.getByText('Sale Complete', { exact: true })).toHaveCount(0)
  })

  test('PO-F04: Clear puts the line back on its list price and takes the reason section away', async ({
    page,
  }) => {
    await openCheckout(page)
    await addItem(page)
    await expect(
      cartRow(page)
        .getByText(/₱[\d,]+\.\d{2}/)
        .first()
    ).toBeVisible({ timeout: 10_000 })
    const listPrice = await rowPrice(page)

    await applyOverride(page, OVERRIDE_PRICE)
    await expect(exceptionSection(page)).toBeVisible()

    await cartRow(page).getByRole('button', { name: 'Clear override' }).click()

    await expect(cartRow(page).getByText('Overridden')).toHaveCount(0)
    await expect(cartRow(page).getByTestId('override-list-price')).toHaveCount(0)
    await expect(exceptionSection(page)).toHaveCount(0)
    await expect.poll(() => rowPrice(page)).toBe(listPrice)
    await expect(cartRow(page).getByRole('button', { name: 'Override price' })).toBeVisible()
  })

  test('PO-F05: a cashier-style sale with an override posts with no PIN, and keeps the reason, note, who applied it and the list price', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'F05')
    await openCheckout(page)
    await addItem(page)
    await selectCustomer(page, customer.name)
    await applyOverride(page, OVERRIDE_PRICE)

    const section = exceptionSection(page)
    await openCustomSelect(section.getByRole('combobox', { name: 'Pick a reason…' }))
    await page.getByRole('listbox').getByRole('option', { name: 'Management special' }).click()
    await fillStable(section.getByLabel('Note for the price override'), 'Kilala ni Boss')

    await fillStable(page.getByLabel('Sales Invoice No.'), `SI-PO71-F05-${Date.now()}`)
    await fillStable(page.getByPlaceholder('0.00').first(), '100000')

    // Not clickStable — this submits a real sale.
    await page.getByRole('button', { name: /Confirm Sale/ }).click()
    await expect(page.getByText('Sale Complete', { exact: true })).toBeVisible({ timeout: 20_000 })

    // The receipt screen says what was overridden and why — list price against
    // the charged one, the reason, the note. On screen only: it is internal.
    const receiptNote = page.getByTestId('success-exception')
    await expect(receiptNote).toContainText('Management special')
    await expect(receiptNote).toContainText('Kilala ni Boss')
    await expect(receiptNote.getByTestId('pos-exception-line')).toContainText('₱12,000.00')
    await expect(receiptNote.getByTestId('pos-exception-line')).toContainText('₱10,000.00')
    await expect(receiptNote).toHaveClass(/print:hidden/)

    // What the sale kept, read back through the API.
    const list = await page.request.get('/api/pos/transactions', {
      params: { customerId: customer.id },
    })
    const rows = (await list.json()) as { id: string }[] | { data: { id: string }[] }
    const first = (Array.isArray(rows) ? rows : rows.data)[0]
    const detail = await (await page.request.get(`/api/pos/transactions/${first.id}`)).json()
    expect(detail.exceptionNote).toBe('Kilala ni Boss')
    expect(detail.exceptionReasonId).toBeTruthy()
    const line = detail.lines[0]
    expect(Number(line.unitPrice)).toBeGreaterThan(0)
    expect(line.priceOverrideBy).toBeTruthy()
    expect(Number(line.listUnitPrice)).toBe(ITEM_PRICE)

    // The same words come back on the transaction detail …
    expect(detail.exception).toMatchObject({
      reason: 'Management special',
      note: 'Kilala ni Boss',
      lines: [{ listUnitPrice: ITEM_PRICE }],
    })
    await gotoReady(
      page,
      `/pos/transactions?search=${encodeURIComponent(detail.transactionNumber)}`
    )
    await page
      .getByText(detail.salesInvoiceNumber ?? detail.transactionNumber)
      .first()
      .click()
    const modalPanel = page.getByTestId('pos-exception-panel')
    await expect(modalPanel).toBeVisible({ timeout: 15_000 })
    await expect(modalPanel).toContainText('Management special')
    await expect(modalPanel).toContainText('Kilala ni Boss')

    // … and on the sale's journal entry, so the books say why the price is what it is.
    expect(detail.journalEntryId).toBeTruthy()
    await gotoReady(page, `/accounting/journal-entries/${detail.journalEntryId}`)
    const jePanel = page.getByTestId('pos-exception-panel')
    await expect(jePanel).toBeVisible({ timeout: 20_000 })
    await expect(jePanel).toContainText('Management special')
    await expect(jePanel).toContainText('Kilala ni Boss')
    await expect(jePanel.getByTestId('pos-exception-line')).toContainText('₱12,000.00')
  })

  test('PO-F07: POS Settings lists the override reasons, adds one, and switching one off takes it out of the checkout dropdown', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const name = `${PREFIX} Reason ${Date.now()}`
    await gotoReady(page, '/pos/settings/override-reasons')
    await expect(page.getByRole('heading', { name: 'Override Reasons' })).toBeVisible({
      timeout: 15_000,
    })
    // The starter list.
    await expect(page.getByLabel('Name of Loyal customer')).toBeVisible()
    await expect(page.getByLabel('Name of Bulk deal')).toBeVisible()

    // Filled until the button enables: before hydration a typed value shows in
    // the box without reaching the page's state, so the button stays off.
    const addButton = page.getByRole('button', { name: 'Add reason' })
    await expect(async () => {
      // Emptied first: a value typed before hydration is the one React then
      // treats as "unchanged", so typing the same text again would not reach it.
      await page.getByLabel('New reason').fill('')
      await page.getByLabel('New reason').fill(name)
      await expect(addButton).toBeEnabled({ timeout: 1_000 })
    }).toPass({ timeout: 15_000 })
    await addButton.click()
    const offer = page.getByLabel(`Offer ${name} at checkout`)
    await expect(offer).toBeChecked({ timeout: 10_000 })

    // On: the checkout dropdown offers it once a line is overridden.
    await openCheckout(page)
    await addItem(page)
    await expect(
      cartRow(page)
        .getByText(/₱[\d,]+\.\d{2}/)
        .first()
    ).toBeVisible({ timeout: 10_000 })
    await applyOverride(page, OVERRIDE_PRICE)
    await openCustomSelect(exceptionSection(page).getByRole('combobox', { name: 'Pick a reason…' }))
    await expect(page.getByRole('listbox').getByRole('option', { name })).toBeVisible()

    // Off: gone from the dropdown, still listed in Settings. Retried from a
    // fresh page: a click that lands before hydration flips the box on screen
    // without reaching the page's handler, and navigating away mid-request
    // would drop it — so each try ends only once the API says it is saved.
    await expect(async () => {
      await gotoReady(page, '/pos/settings/override-reasons')
      await page.getByLabel(`Offer ${name} at checkout`).uncheck()
      await expect
        .poll(
          async () => {
            const rows = (await (await page.request.get('/api/pos/override-reasons')).json()) as {
              name: string
              isActive: boolean
            }[]
            return rows.find((r) => r.name === name)?.isActive
          },
          // Long enough for a first server-action call to finish compiling on
          // a cold dev server: giving up sooner reloads the page and drops the
          // very request that was about to land.
          { timeout: 30_000 }
        )
        .toBe(false)
    }).toPass({ timeout: 100_000 })
    await openCheckout(page)
    await addItem(page)
    await expect(
      cartRow(page)
        .getByText(/₱[\d,]+\.\d{2}/)
        .first()
    ).toBeVisible({ timeout: 10_000 })
    await applyOverride(page, OVERRIDE_PRICE)
    await openCustomSelect(exceptionSection(page).getByRole('combobox', { name: 'Pick a reason…' }))
    await expect(page.getByRole('listbox').getByRole('option', { name })).toHaveCount(0)
    await expect(page.getByRole('listbox').getByRole('option', { name: 'Bulk deal' })).toBeVisible()
  })

  test('PO-F06: the override is unavailable offline', async ({ page }) => {
    await openCheckout(page)
    await addItem(page)
    await expect(
      cartRow(page)
        .getByText(/₱[\d,]+\.\d{2}/)
        .first()
    ).toBeVisible({ timeout: 10_000 })

    await page.context().setOffline(true)
    try {
      await expect(cartRow(page).getByRole('button', { name: 'Override price' })).toBeDisabled()
    } finally {
      await page.context().setOffline(false)
    }
    await expect(cartRow(page).getByRole('button', { name: 'Override price' })).toBeEnabled()
  })
})
