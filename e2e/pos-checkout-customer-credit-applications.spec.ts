import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Picking a customer at POS checkout shows their approved, unused credit
// applications on the customer card straight away — whatever the cart holds.
// The "Approved Credit Application" picker further down only appears once the
// cart has an installment line, which left a cashier unable to tell whether a
// customer had an application at all. This spec stays on the empty-cart state
// to prove exactly that; the picker itself is covered by
// pos-checkout-installment-credit-application.spec.ts.
//
// No cleanup: CreditApplication rows are never hard-deleted by this app, so
// the customers they reference cannot be either (onDelete: Restrict) — the
// same tradeoff as the other credit e2e specs. Run against the throwaway test
// database.

// A real, WIP-priced item in the seeded catalog.
const ITEM_QUERY = 'STF3238'
const BRANCH = 'Bago'

async function createCustomer(request: APIRequestContext, label: string) {
  const name = `E2E CardApps ${label} ${Date.now()}`
  const res = await request.post('/api/crm/customers', {
    data: {
      name,
      customerType: 'individual',
      phone: `0917${Date.now().toString().slice(-7)}`,
      coMakers: [
        { name: 'E2E CardApps Co-Maker', relationship: 'Sibling', contactNumber: '09171112222' },
      ],
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const customer = (await res.json()) as { id: string; coMakers: { id: string }[] }
  return { id: customer.id, coMakerId: customer.coMakers[0].id, name }
}

async function ensureOpenSession(request: APIRequestContext): Promise<void> {
  const branches = ((await (await request.get('/api/branches?limit=200')).json()).data ?? []) as {
    id: string
    name: string
  }[]
  const branchId = branches.find((b) => b.name === BRANCH)!.id
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

/** A draft application for the customer — created, not yet through approval. */
async function createApplication(
  request: APIRequestContext,
  customer: { id: string; coMakerId: string }
) {
  const branches = ((await (await request.get('/api/branches?limit=200')).json()).data ?? []) as {
    id: string
    name: string
  }[]
  const branchId = branches.find((b) => b.name === BRANCH)!.id
  const items = ((
    await (
      await request.get('/api/inventory/items', { params: { search: ITEM_QUERY, limit: '1' } })
    ).json()
  ).data ?? []) as { id: string; name: string }[]

  const priceUseBody = (await (await request.get('/api/pos/catalog/price-use-types')).json()) as
    | { id: string; name: string }[]
    | { data?: { id: string; name: string }[] }
  const priceUses = Array.isArray(priceUseBody) ? priceUseBody : (priceUseBody.data ?? [])
  const wip = priceUses.find((t) => t.name === 'WIP')!

  const res = await request.post('/api/credit/applications', {
    data: {
      branchId,
      applicantCustomerId: customer.id,
      coMakerId: customer.coMakerId,
      items: [{ itemId: items[0].id }],
      priceUseTypeId: wip.id,
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const application = (await res.json()) as {
    id: string
    applicationNumber: string
    items: { id: string }[]
  }
  return { ...application, itemName: items[0].name }
}

/** Takes the application through submit → investigation → approval. */
async function approveApplication(
  request: APIRequestContext,
  application: { id: string; items: { id: string }[] }
) {
  const upload = await request.post('/api/files/upload', {
    multipart: { file: { name: 'id.txt', mimeType: 'text/plain', buffer: Buffer.from('fake id') } },
  })
  const file = await upload.json()
  await request.post(`/api/credit/applications/${application.id}/documents`, {
    data: { fileId: file.id, documentType: 'applicant_id' },
  })
  await request.patch(`/api/credit/applications/${application.id}/submit`)
  await request.post(`/api/credit/applications/${application.id}/investigation/start`)
  await request.post(`/api/credit/applications/${application.id}/investigation`, {
    data: { affordabilityOutcome: 'recommend_approve', notes: 'Looks fine' },
  })
  const decided = await request.patch(`/api/credit/applications/${application.id}/decide`, {
    data: { approveItemIds: [application.items[0].id], declineItemIds: [] },
  })
  expect(decided.ok(), await decided.text()).toBeTruthy()
}

/** An owner sees every branch's open sessions: with several open the checkout asks
 * which one to ring on, with exactly one it simply picks it. Handles both. */
async function pickSessionIfAsked(page: Page): Promise<void> {
  const sessionSelect = page.locator('select').filter({ hasText: 'Select session' })
  const autoSelected = page.getByText(/^Counter \d+$/).first()
  await expect(sessionSelect.or(autoSelected)).toBeVisible({ timeout: 20_000 })
  if (await sessionSelect.isVisible()) {
    const value = await sessionSelect
      .locator('option', { hasText: BRANCH })
      .first()
      .getAttribute('value')
    await sessionSelect.selectOption(value!)
  }
}

async function selectCustomer(page: Page, name: string): Promise<void> {
  // Settled first — the catalog loaded and a session chosen — so the page is done
  // re-rendering before anything is typed into the search.
  await expect(page.getByPlaceholder('Search by name or serial')).toBeVisible({ timeout: 20_000 })
  await pickSessionIfAsked(page)
  const input = page.getByPlaceholder('Search by name or phone…')
  await input.click()
  await fillStable(input, name)
  await page.getByRole('button', { name: new RegExp(name) }).click()
}

const card = (page: Page) => page.getByTestId('customer-credit-applications')

test.describe('POS Checkout — the customer card shows approved credit applications', () => {
  test.describe.configure({ timeout: 120_000 })

  test.beforeAll(async ({ playwright }, testInfo) => {
    const request = await playwright.request.newContext({
      baseURL: testInfo.project.use.baseURL!,
      storageState: 'e2e/.auth/business-owner.json',
    })
    await ensureOpenSession(request)
    await request.dispose()
  })

  test('CA-F01: a customer with no application reads "No approved credit application on file." and the cart is still empty', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'None')

    await gotoReady(page, '/pos/checkout')
    await selectCustomer(page, customer.name)

    await expect(card(page)).toContainText('No approved credit application on file.')
    await expect(page.getByText('Subtotal (0 items)')).toBeVisible()
  })

  test('CA-F02: an approved application is listed with its number, item and amount before anything is in the cart — a draft one is not', async ({
    page,
  }) => {
    const customer = await createCustomer(page.request, 'Approved')
    const approved = await createApplication(page.request, customer)
    await approveApplication(page.request, approved)
    // A second application that never got past draft: not usable at checkout.
    const draft = await createApplication(page.request, customer)

    await gotoReady(page, '/pos/checkout')
    await selectCustomer(page, customer.name)

    const rows = page.getByTestId('customer-credit-application')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText(approved.applicationNumber)
    await expect(rows.first()).toContainText(approved.itemName)
    await expect(rows.first()).toContainText(/₱[\d,]+\.\d{2}/)
    await expect(card(page)).not.toContainText(draft.applicationNumber)
    await expect(card(page)).not.toContainText('No approved credit application on file.')
    await expect(page.getByText('Subtotal (0 items)')).toBeVisible()
  })

  test('CA-F03: clearing the customer removes the list, and picking another customer shows theirs instead', async ({
    page,
  }) => {
    const withApp = await createCustomer(page.request, 'Has')
    const application = await createApplication(page.request, withApp)
    await approveApplication(page.request, application)
    const without = await createCustomer(page.request, 'Hasnt')

    await gotoReady(page, '/pos/checkout')
    await selectCustomer(page, withApp.name)
    await expect(card(page)).toContainText(application.applicationNumber)

    await page.getByRole('button', { name: 'Clear customer' }).click()
    await expect(card(page)).toHaveCount(0)

    await selectCustomer(page, without.name)
    await expect(card(page)).toContainText('No approved credit application on file.')
    await expect(card(page)).not.toContainText(application.applicationNumber)
  })
})
