import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import {
  createSellableItem,
  deleteCustomers,
  deleteItem,
  fillStable,
  gotoReady,
  openCustomSelect,
  pickCartPriceUse,
  sweepE2ECustomers,
  sweepE2EPriceLists,
  sweepE2EPriceUseTypes,
} from './utils'

// A real in-house installment plan for POS Collections specs, built the way a
// cashier makes one: through checkout, the credit application waived by the
// Business Owner, the down payment taken in cash. Specs that need "a customer
// with open dues" use this instead of the seed, which has none, or a bare
// POST /api/pos/transactions, which now also needs an approved credit
// application. Same flow as pos-collections-multiple-payments.

export const PLAN_BRANCH = 'Bago'
export const OWNER_STATE = 'e2e/.auth/business-owner.json'
const ITEM_PRICE = 12000

export type PlanFixtures = {
  prefix: string
  itemId: string
  itemName: string
  priceUseTypeName: string
  priceUseTypeId: string
  priceListId: string
  branchId: string
  customerIds: string[]
}

async function priceItem(request: APIRequestContext, prefix: string, itemId: string) {
  const stamp = Date.now()
  const name = `${prefix} PU ${stamp}`
  const putRes = await request.post('/api/inventory/price-use-types', { data: { name } })
  expect(putRes.ok(), await putRes.text()).toBeTruthy()
  const priceUseType = await putRes.json()
  const listRes = await request.post('/api/inventory/price-lists', {
    data: { name: `${prefix} List ${stamp}`, priceUseTypeId: priceUseType.id },
  })
  expect(listRes.ok(), await listRes.text()).toBeTruthy()
  const priceList = await listRes.json()
  const itemsRes = await request.post(`/api/inventory/price-lists/${priceList.id}/items`, {
    data: { items: [{ itemId, price: ITEM_PRICE }] },
  })
  expect(itemsRes.ok(), await itemsRes.text()).toBeTruthy()
  const approveRes = await request.post(`/api/inventory/price-lists/${priceList.id}/approve`, {
    data: {},
  })
  expect(approveRes.ok(), await approveRes.text()).toBeTruthy()
  return { name, priceUseTypeId: priceUseType.id as string, priceListId: priceList.id as string }
}

async function branchIdOf(request: APIRequestContext, name: string): Promise<string> {
  const branches = ((await (await request.get('/api/branches?limit=200')).json()).data ?? []) as {
    id: string
    name: string
  }[]
  return branches.find((b) => b.name === name)!.id
}

/** Clears what an earlier run under `prefix` left, then makes a sellable,
 * priced, stocked item and makes sure the branch has an open session. */
export async function createPlanFixtures(
  request: APIRequestContext,
  prefix: string
): Promise<PlanFixtures> {
  await sweepE2ECustomers(request, prefix)
  await sweepE2EPriceLists(request, prefix)
  await sweepE2EPriceUseTypes(request, prefix)
  const branchId = await branchIdOf(request, PLAN_BRANCH)
  const item = await createSellableItem(request, {
    prefix,
    branchName: PLAN_BRANCH,
    sellingPrice: ITEM_PRICE,
  })
  const price = await priceItem(request, prefix, item.id)
  await ensureOpenSession(request, branchId)
  return {
    prefix,
    itemId: item.id,
    itemName: item.name,
    priceUseTypeName: price.name,
    priceUseTypeId: price.priceUseTypeId,
    priceListId: price.priceListId,
    branchId,
    customerIds: [],
  }
}

export async function deletePlanFixtures(
  request: APIRequestContext,
  fx: PlanFixtures | undefined
): Promise<void> {
  if (!fx) return
  await deleteCustomers(request, fx.customerIds)
  await request.delete(`/api/inventory/price-lists/${fx.priceListId}`).catch(() => {})
  await request.delete(`/api/inventory/price-use-types/${fx.priceUseTypeId}`).catch(() => {})
  await deleteItem(request, fx.itemId)
}

/** Leaves an open session on the branch's terminal, reusing one already open.
 * Opened by the Business Owner, so Collections attaches to it as their own. */
export async function ensureOpenSession(
  request: APIRequestContext,
  branchId: string
): Promise<void> {
  const terminals = (await (
    await request.get('/api/pos/terminals', { params: { branchId } })
  ).json()) as { id: string; status: string }[]
  const terminal = terminals.find((t) => t.status === 'active') ?? terminals[0]
  const open = (await (
    await request.get('/api/pos/sessions', { params: { terminalId: terminal.id, status: 'open' } })
  ).json()) as { id: string }[]
  if (open.length) return
  const res = await request.post('/api/pos/sessions/open', {
    data: { terminalId: terminal.id, openingCash: 1000 },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
}

async function createCustomer(request: APIRequestContext, fx: PlanFixtures, label: string) {
  const name = `${fx.prefix} ${label} ${Date.now()}`
  const res = await request.post('/api/crm/customers', {
    data: {
      name,
      customerType: 'individual',
      phone: `0917${Date.now().toString().slice(-7)}`,
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const customer = (await res.json()) as { id: string }
  fx.customerIds.push(customer.id)
  return { id: customer.id, name }
}

async function pickSessionIfAsked(page: Page): Promise<void> {
  await expect(page.getByPlaceholder('Search by name or serial')).toBeVisible({ timeout: 15_000 })
  const sessionSelect = page.locator('select').filter({ hasText: 'Select session' })
  const autoSelected = page.getByText(/^Counter \d+$/).first()
  await expect(sessionSelect.or(autoSelected)).toBeVisible({ timeout: 15_000 })
  if (await sessionSelect.isVisible()) {
    const value = await sessionSelect
      .locator('option', { hasText: PLAN_BRANCH })
      .first()
      .getAttribute('value')
    await sessionSelect.selectOption(value!)
  }
}

async function addItemAndCustomer(page: Page, fx: PlanFixtures, customerName: string) {
  const search = page.getByPlaceholder('Search by name or serial')
  await expect(search).toBeVisible({ timeout: 15_000 })
  await search.fill(fx.itemName)
  const card = page
    .getByRole('button')
    .filter({ has: page.getByText(fx.itemName, { exact: true }) })
  await expect(card.first()).toBeVisible({ timeout: 15_000 })
  await card.first().click()
  await pickCartPriceUse(page, fx.priceUseTypeName)
  const input = page.getByPlaceholder('Search by name or phone…')
  await input.click()
  await fillStable(input, customerName)
  await page.getByRole('button', { name: new RegExp(customerName) }).click()
}

async function fillInstallmentTerms(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Installment', exact: true }).click()
  const termSelect = page.getByRole('combobox', { name: 'Select a term…' })
  await expect(termSelect).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('credit-waiver-checkbox').check()
  await openCustomSelect(termSelect)
  await page.getByRole('listbox').getByRole('option').first().click()
  const section = page.getByTestId('price-override-exception')
  await openCustomSelect(section.getByRole('combobox', { name: 'Pick a reason…' }))
  await page.getByRole('listbox').getByRole('option', { name: 'Management special' }).click()
  await fillStable(
    section.getByLabel('Note for the price override or typed terms'),
    'E2E collections plan fixture'
  )
}

async function payDownPaymentInCash(page: Page, tag: string): Promise<void> {
  await page
    .getByTestId('dp-payment-mode-toggle')
    .getByRole('button', { name: 'Cash', exact: true })
    .click()
  const dpText = await page.getByTestId('dp-payment-mode-toggle').innerText()
  const dp = Number(dpText.match(/₱([\d,]+\.\d{2})/)![1].replace(/,/g, ''))
  await fillStable(page.getByLabel('Amount received'), String(dp))
  await fillStable(page.getByLabel('CR Number'), `CR-${tag}-DP-${Date.now()}`)
}

/** A fresh customer with an in-house installment plan; returns that customer. */
export async function createInstallmentPlan(
  page: Page,
  fx: PlanFixtures,
  label: string
): Promise<{ id: string; name: string }> {
  const customer = await createCustomer(page.request, fx, label)
  const tag = label.replace(/\W/g, '').toUpperCase()
  await gotoReady(page, '/pos/checkout')
  await pickSessionIfAsked(page)
  await addItemAndCustomer(page, fx, customer.name)
  await fillInstallmentTerms(page)
  await fillStable(page.getByLabel('Sales Invoice No.'), `SI-${tag}-${Date.now()}`)
  await payDownPaymentInCash(page, tag)
  await page.getByRole('button', { name: /Create Installment Plan/ }).click()
  await expect(page.getByText('Installment Plan Created', { exact: true })).toBeVisible({
    timeout: 45_000,
  })
  return customer
}

/** Opens a customer on POS Collections (no due ticked yet). */
export async function openCustomerOnCollections(page: Page, customerName: string): Promise<void> {
  await gotoReady(page, '/pos/collections')
  await fillStable(page.getByPlaceholder('Filter by name or phone…'), customerName)
  const row = page.locator('ul > li > button').filter({ hasText: customerName }).first()
  await expect(row).toBeVisible({ timeout: 15_000 })
  await row.click()
}

/** The due list's row for "Payment n of …". */
export const dueRow = (page: Page, n: number) =>
  page.locator('li').filter({ hasText: `Payment ${n} of` })

/** Ticks due `n` and waits for the panel to settle: the branch's payment
 * methods load a moment after it opens (until then only Check is offered),
 * and anything typed before that can be lost. */
export async function tickDue(page: Page, n: number): Promise<void> {
  await dueRow(page, n).getByRole('checkbox').check()
  await expect(page.getByRole('heading', { name: 'Collect Payment' })).toBeVisible()
  await expect(
    page.getByTestId('collection-method-0').getByRole('button', { name: 'Debit/Credit Card' })
  ).toBeVisible({ timeout: 15_000 })
}

/** A peso amount as shown on screen (₱3,888.00, −₱120.00) as a number. */
export const pesos = (text: string): number => Number(text.replace(/[^\d.]/g, ''))

const grouped = (n: string) => n.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/** Types an amount into a MoneyInput and waits until it shows it grouped. */
export async function fillMoney(locator: Locator, value: number): Promise<void> {
  const [whole, decimals] = String(value).split('.')
  const shown = decimals === undefined ? grouped(whole) : `${grouped(whole)}.${decimals}`
  await expect(async () => {
    await locator.fill(String(value))
    await expect(locator).toHaveValue(shown)
  }).toPass({ timeout: 10_000 })
}
