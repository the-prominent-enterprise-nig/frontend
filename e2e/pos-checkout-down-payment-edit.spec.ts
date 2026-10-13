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
} from './utils'

// Scenario 71 Part 2 (item 6) — the down payment reads as editable, and a TPF
// down payment may be ₱0. Chloe's down-payment box stays as she built it; only
// her "Change amount" link became an "Edit" button (Kian, 2026-10-13). Case
// IDs (S71-2-F…) match docs/scenario-71-pos-invoice-number-cr-dp-tax-exempt-plan.md.
// The rate-card lock (S71-2-F03) is covered by pr199-checkout-down-payment.
//
// Fixtures follow pos-money-input: a fresh non-serial item stocked at Bago and
// priced ₱12,000 on a Price Use + price list of its own (no rate-card down
// payment, so the 10% floor applies inhouse), an E2E customer and an E2E TPF
// provider. Nothing is sold: the TPF test stops at a ready Confirm button.

const PREFIX = 'E2E S71 DP'
const BRANCH = 'Bago'
const ITEM_PRICE = 12000

type Fixtures = {
  itemId: string
  itemName: string
  priceUseTypeName: string
  priceUseTypeId: string
  priceListId: string
  branchId: string
  tpfProviderId: string
  tpfProviderName: string
}

let fx: Fixtures
const createdCustomerIds: string[] = []

async function ownerRequest(
  playwright: PlaywrightWorkerArgs['playwright'],
  baseURL: string
): Promise<APIRequestContext> {
  return playwright.request.newContext({ baseURL, storageState: 'e2e/.auth/business-owner.json' })
}

async function createItemAndPrice(
  request: APIRequestContext,
  stamp: number
): Promise<Omit<Fixtures, 'tpfProviderId' | 'tpfProviderName'>> {
  const anyItemRes = await request.get('/api/inventory/items?limit=1')
  const baseUnitId = ((await anyItemRes.json()).data ?? [])[0].baseUnit.id as string
  const itemName = `${PREFIX} Item ${stamp}`
  const itemRes = await request.post('/api/inventory/items', {
    data: {
      sku: `E2E-S71-DP-${stamp}`,
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
      notes: 'E2E S71 down-payment fixture stock',
      lines: [{ itemId: item.id, expectedQty: 0, actualQty: 10 }],
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

async function createFixtures(request: APIRequestContext): Promise<Fixtures> {
  const stamp = Date.now()
  const base = await createItemAndPrice(request, stamp)
  const tpfProviderName = `${PREFIX} Financier ${stamp}`
  const tpfRes = await request.post('/api/pos/tpf-providers', { data: { name: tpfProviderName } })
  expect(tpfRes.ok(), await tpfRes.text()).toBeTruthy()
  return { ...base, tpfProviderId: (await tpfRes.json()).id, tpfProviderName }
}

async function createCustomer(request: APIRequestContext, label: string): Promise<string> {
  const name = `${PREFIX} ${label} ${Date.now()}`
  const res = await request.post('/api/crm/customers', {
    data: {
      name,
      customerType: 'individual',
      phone: `0917${Date.now().toString().slice(-7)}`,
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  createdCustomerIds.push((await res.json()).id)
  return name
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

/** A checkout with the fixture item on its Price Use, a customer, and every
 * line on Installment. */
async function installmentCart(page: Page, customerName: string): Promise<void> {
  await gotoReady(page, '/pos/checkout')
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
  await page.getByPlaceholder('Search by name or serial').fill(fx.itemName)
  const card = page
    .getByRole('button')
    .filter({ has: page.getByText(fx.itemName, { exact: true }) })
  await expect(card.first()).toBeVisible({ timeout: 15_000 })
  await card.first().click()
  await page.getByLabel('Price Use').first().selectOption({ label: fx.priceUseTypeName })

  const customerSearch = page.getByPlaceholder('Search by name or phone…')
  await customerSearch.click()
  await fillStable(customerSearch, customerName)
  await page.getByRole('button', { name: new RegExp(customerName) }).click()
  await page.getByRole('button', { name: 'Installment', exact: true }).click()
}

/** The line's own installment panel (same locator as pr199-checkout-down-payment). */
const linePanel = (page: Page): Locator =>
  page
    .locator('div.rounded-lg.border-purple-100', { hasText: fx.itemName })
    .filter({ has: page.getByRole('button', { name: 'Inhouse Installment' }) })
    .last()

test.describe('Down payment field (Scenario 71 Part 2)', () => {
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
      await request.delete(`/api/pos/tpf-providers/${fx.tpfProviderId}`).catch(() => {})
      await request.delete(`/api/inventory/price-lists/${fx.priceListId}`).catch(() => {})
      await request.delete(`/api/inventory/price-use-types/${fx.priceUseTypeId}`).catch(() => {})
      await request.delete(`/api/inventory/items/${fx.itemId}`).catch(() => {})
    }
    await request.dispose()
  })

  test("S71-2-F01 / F02 / F05: inhouse — Chloe's box shows the 10% down payment with a clear Edit button; the field it opens keeps the 10% minimum", async ({
    page,
  }) => {
    await installmentCart(page, await createCustomer(page.request, 'F01'))
    const panel = linePanel(page)
    await expect(panel).toBeVisible({ timeout: 15_000 })
    await openCustomSelect(panel.getByRole('combobox', { name: /Select a term|months/ }))
    await page.getByRole('listbox').getByRole('option').first().click()

    // Chloe's box, unchanged: the figure and its "10% min" pill.
    await expect(panel).toContainText('₱1,200.00', { timeout: 15_000 })
    await expect(panel).toContainText('10% min')
    // Her dotted "Change amount" link is now a real button.
    await expect(panel.getByRole('button', { name: 'Change amount' })).toHaveCount(0)
    const edit = panel.getByRole('button', { name: 'Edit down payment' })
    await expect(edit).toBeVisible()
    await expect(edit).toHaveText('Edit')
    await edit.click()

    const field = page.getByPlaceholder('Down payment')
    await expect(field).toBeVisible()
    await expect(field).toHaveValue('1,200.00')
    // Inhouse keeps its floor (Kian, 2026-10-08: never 0).
    await expect(panel).toContainText('Must be at least ₱1,200.00')
  })

  test('S71-2-F04: TPF — a down payment of ₱0 is allowed: no minimum, no down payment method, nothing to collect, and the sale is ready to confirm', async ({
    page,
  }) => {
    await installmentCart(page, await createCustomer(page.request, 'F04'))
    const panel = linePanel(page)
    await expect(panel).toBeVisible({ timeout: 15_000 })
    await panel.getByRole('button', { name: 'TPF Installment' }).click()

    // Pre-filled at 10% as before, but labelled as having no minimum.
    await expect(panel).toContainText('₱1,200.00', { timeout: 15_000 })
    await expect(panel).toContainText('No minimum')
    await panel.getByRole('button', { name: 'Edit down payment' }).click()
    const field = page.getByPlaceholder('Down payment')
    await field.click()
    await field.fill('0')
    await field.blur()
    await expect(field).toHaveValue('0.00')
    await expect(panel).toContainText('₱0 if the financier funds it all')

    await openCustomSelect(page.getByRole('combobox', { name: /Select a TPF provider/ }))
    await page.getByRole('option', { name: fx.tpfProviderName, exact: true }).click()
    await fillStable(
      page.getByPlaceholder("Financier's reference number *"),
      `S71-TPF-${Date.now()}`
    )

    // Nothing is collected at the register, so no down payment method and no
    // tender/CR — and the button is ready, not asking for a down payment.
    await expect(page.getByTestId('dp-payment-mode-toggle')).toHaveCount(0)
    await expect(page.getByText('Nothing to collect for the items at checkout')).toBeVisible()
    await expect(page.getByLabel('Amount received')).toHaveCount(0)
    const confirm = page.getByRole('button', { name: 'Create Installment Plan' })
    await expect(confirm).toBeVisible()
    await expect(confirm).toBeEnabled()
  })
})
