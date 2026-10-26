import { expect, type Page } from '@playwright/test'
import { clickStable, fillStable, pickCartPriceUse } from './utils'

// Shared by the specs that take a credit application to the till
// (credit-application-low-down-payment, credit-application-fmi-checkout).
//
// DOWELL STF3238 is on the WIP list with no rate-card row, so its down payment
// and terms are open — nothing fixes them.

export const ITEM_QUERY = 'STF3238'
export const NAME_PREFIX = 'E2E CA CHECKOUT'

type FinancingTerm = { id: string; termMonths: number }

/** Puts one item in the cart, picking a unit if it is serial-tracked, and
 * prices it under WIP. `priceUseRow` is the 0-based cart row it lands in. */
export async function addItemToCart(page: Page, query: string, priceUseRow = 0): Promise<void> {
  const searchInput = page.getByPlaceholder('Search by name or serial')
  await expect(searchInput).toBeVisible({ timeout: 15_000 })
  const card = page.getByRole('button').filter({ hasText: query }).first()
  await expect(async () => {
    await searchInput.fill(query)
    await expect(card).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 20_000 })
  await card.click()

  const heading = page.getByRole('heading', { name: 'Select Serial Number' })
  if (await heading.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page
      .getByText('In this branch', { exact: true })
      .locator('xpath=following-sibling::*[1]')
      .getByRole('button')
      .first()
      .click()
    await expect(heading).toHaveCount(0, { timeout: 10_000 })
  }
  await pickCartPriceUse(page, 'WIP', priceUseRow)
}

/** Adds the fan to the cart as an in-house installment line. */
export async function addInstallmentLine(page: Page): Promise<void> {
  await addItemToCart(page, ITEM_QUERY)
  await clickStable(
    page.getByRole('button', { name: 'Installment', exact: true }),
    page.getByRole('button', { name: 'Inhouse Installment' })
  )
}

/** The till needs an open session at the application's branch. Reuses one that
 * is already open; opens one otherwise. */
export async function ensureOpenSession(page: Page, branchId: string): Promise<void> {
  const terminalsRes = await page.request.get('/api/pos/terminals', { params: { branchId } })
  const terminals = (await terminalsRes.json()) as { id: string; status: string }[]
  const terminal = terminals.find((t) => t.status === 'active') ?? terminals[0]
  const sessionsRes = await page.request.get('/api/pos/sessions', {
    params: { terminalId: terminal.id, status: 'open' },
  })
  const open = (await sessionsRes.json()) as unknown[]
  if (open.length > 0) return
  const opened = await page.request.post('/api/pos/sessions/open', {
    data: { terminalId: terminal.id, openingCash: 1000 },
  })
  expect(opened.ok(), await opened.text()).toBeTruthy()
}

/** Makes sure Bago has an open till session, so checkout opens. */
export async function ensureBagoSession(page: Page): Promise<void> {
  const branchesRes = await page.request.get('/api/branches?limit=200')
  const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
  const bago = branches.find((b) => b.name === 'Bago')
  expect(bago, 'no Bago branch').toBeTruthy()
  await ensureOpenSession(page, bago!.id)
}

/** An APPROVED application for the fan with a down payment of `percent` of its
 * item total — and an FMI date, if given — raised and decided through the API.
 * Returns the figures. */
export async function approvedApplication(
  page: Page,
  opts: { percent: number; firstDueDate?: string }
) {
  const name = `${NAME_PREFIX} ${Date.now()}${Math.floor(Math.random() * 1000)}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: {
      name,
      customerType: 'individual',
      phone: `+63917${Date.now().toString().slice(-7)}`,
      coMakers: [
        { name: 'E2E Low DP Co-Maker', relationship: 'Sibling', contactNumber: '09171116666' },
      ],
    },
  })
  expect(customerRes.ok()).toBeTruthy()
  const customer = await customerRes.json()

  const branchesRes = await page.request.get('/api/branches?limit=200')
  const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
  const branchId = branches.find((b) => b.name === 'Bago')!.id

  // The search is fuzzy (STF3218AS ranks ahead of STF3238), so the item is
  // picked by its name, not by taking the first hit.
  const itemsRes = await page.request.get('/api/inventory/items', {
    params: { search: ITEM_QUERY, limit: '20' },
  })
  const items = ((await itemsRes.json()).data ?? []) as { id: string; name: string }[]
  const fan = items.find((i) => i.name.includes(ITEM_QUERY))
  expect(fan, `no item named ${ITEM_QUERY}`).toBeTruthy()

  const priceUseRes = await page.request.get('/api/pos/catalog/price-use-types')
  type PriceUse = { id: string; name: string }
  const priceUseBody = (await priceUseRes.json()) as PriceUse[] | { data?: PriceUse[] }
  const priceUses = Array.isArray(priceUseBody) ? priceUseBody : (priceUseBody.data ?? [])
  const wip = priceUses.find((t) => t.name === 'WIP')!

  const termsRes = await page.request.get(`/api/pos/financing-terms/active?branchId=${branchId}`)
  const termsBody = await termsRes.json()
  const terms = (termsBody.data ?? termsBody) as FinancingTerm[]
  const term = terms.find((t) => t.termMonths === 3) ?? terms[0]
  expect(term, 'no active financing term in this seed').toBeTruthy()

  // Raised without a term first, to read the item total the server resolved,
  // then given the term and the low down payment.
  const created = await page.request.post('/api/credit/applications', {
    data: {
      branchId,
      applicantCustomerId: customer.id,
      coMakerId: customer.coMakers[0].id,
      items: [{ itemId: fan!.id }],
      priceUseTypeId: wip.id,
      ...(opts.firstDueDate ? { firstDueDate: opts.firstDueDate } : {}),
    },
  })
  expect(created.ok(), await created.text()).toBeTruthy()
  const application = await created.json()
  const total = Number(application.requestedAmount)
  const downPayment = Number((total * opts.percent).toFixed(2))
  expect(downPayment).toBeGreaterThan(0)

  const patched = await page.request.patch(`/api/credit/applications/${application.id}`, {
    data: { financingTermId: term.id, downPayment },
  })
  expect(patched.ok(), await patched.text()).toBeTruthy()

  const upload = await page.request.post('/api/files/upload', {
    multipart: { file: { name: 'id.txt', mimeType: 'text/plain', buffer: Buffer.from('fake id') } },
  })
  const file = await upload.json()
  await page.request.post(`/api/credit/applications/${application.id}/documents`, {
    data: { fileId: file.id, documentType: 'applicant_id' },
  })
  await page.request.patch(`/api/credit/applications/${application.id}/submit`)
  await page.request.post(`/api/credit/applications/${application.id}/investigation/start`)
  await page.request.post(`/api/credit/applications/${application.id}/investigation`, {
    data: { affordabilityOutcome: 'recommend_approve', notes: 'Looks fine' },
  })
  const decided = await page.request.patch(`/api/credit/applications/${application.id}/decide`, {
    data: { approveItemIds: [application.items[0].id], declineItemIds: [] },
  })
  expect(decided.ok(), await decided.text()).toBeTruthy()

  await ensureOpenSession(page, branchId)

  return {
    name,
    applicationNumber: application.applicationNumber as string,
    id: application.id as string,
    total,
    downPayment,
    termMonths: term.termMonths,
  }
}

export async function pickCustomer(page: Page, name: string): Promise<void> {
  const customerInput = page.getByPlaceholder('Search by name or phone…')
  await customerInput.click()
  await fillStable(customerInput, name)
  await page.getByRole('button', { name: new RegExp(name) }).click()
}
