import {
  test,
  expect,
  type APIRequestContext,
  type Page,
  type PlaywrightWorkerArgs,
} from '@playwright/test'
import { gotoReady, loginAs, sweepE2ECustomers, deleteCustomers } from './utils'

// Scenario 67 Part 4 — the "X-Deal offset" action in Accounting > Credit
// Memos. The memo's own rules (JE split, atomicity, guards, void restoring
// everything) are covered by backend/test/credit-memos-x-deal.e2e-spec.ts;
// this spec covers the screen that drives them. Case IDs (XD-F…) match
// docs/scenario-67-x-deal-transaction-plan.md.
//
// Every sale here is created through the API as Business Owner — the
// checkout UI that rings one up is pos-checkout-x-deal.spec.ts's job.

const PREFIX = 'E2E XDMemo'
const BRANCH = 'Bago'
const PRICE = 15000
const DEV_PASSWORD = 'dev-prominent-enterprise-2026'
const BRANCH_MANAGER_EMAIL = 'technova.b1.manager@test.com'

type Sale = {
  customerId: string
  customerName: string
  transactionId: string
}

type Fixtures = {
  itemId: string
  itemName: string
  sessionId: string
  financingTermId: string
  xDeal: Sale
  ordinary: Sale
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

async function createStockedItem(request: APIRequestContext, branchId: string) {
  const anyItem = await (await request.get('/api/inventory/items?limit=1')).json()
  const baseUnitId = anyItem.data[0].baseUnit.id as string
  const stamp = Date.now()
  const name = `${PREFIX} Item ${stamp}`
  const res = await request.post('/api/inventory/items', {
    data: {
      sku: `E2E-XDMEMO-${stamp}`,
      name,
      baseUnitId,
      isSerialTracked: false,
      sellingPrice: PRICE,
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const item = await res.json()
  await request.post(`/api/inventory/items/${item.id}/submit`)
  await request.post(`/api/inventory/items/${item.id}/confirm-accounting`, { data: {} })
  await request.post(`/api/inventory/items/${item.id}/approve`, { data: {} })

  const warehouses = (await (await request.get('/api/inventory/warehouses?limit=200')).json())
    .data as { id: string; branchId: string | null }[]
  const warehouse = warehouses.find((w) => w.branchId === branchId)!
  const adjust = await request.post('/api/inventory/adjustments', {
    data: {
      warehouseId: warehouse.id,
      adjustmentDate: new Date().toISOString().slice(0, 10),
      reasonCode: 'found',
      notes: 'E2E X-Deal memo fixture stock',
      lines: [{ itemId: item.id, expectedQty: 0, actualQty: 20 }],
    },
  })
  expect(adjust.ok(), await adjust.text()).toBeTruthy()
  const adjustment = await adjust.json()
  for (const step of ['confirm', 'investigate', 'approve']) {
    const r = await request.patch(`/api/inventory/adjustments/${adjustment.id}/${step}`)
    expect(r.ok(), await r.text()).toBeTruthy()
  }
  return { itemId: item.id as string, itemName: name }
}

/** Reuses the terminal's open session if there is one — closing it would
 * need the declared cash to match (or a manager override), and any open
 * session on this branch's terminal will do for an API-created sale. */
async function openSession(request: APIRequestContext, branchId: string): Promise<string> {
  const terminals = (await (
    await request.get('/api/pos/terminals', { params: { branchId } })
  ).json()) as { id: string; status: string }[]
  const terminal = terminals.find((t) => t.status === 'active') ?? terminals[0]
  const open = (await (
    await request.get('/api/pos/sessions', { params: { terminalId: terminal.id, status: 'open' } })
  ).json()) as { id: string }[]
  if (open.length) return open[0].id
  const res = await request.post('/api/pos/sessions/open', {
    data: { terminalId: terminal.id, openingCash: 1000 },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  return (await res.json()).id as string
}

async function createCustomer(
  request: APIRequestContext,
  label: string,
  extra: Record<string, unknown> = {}
) {
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
  return { id: customer.id as string, name }
}

/** Business Owner holds the release override, but approve a hold if one comes back. */
async function postSale(request: APIRequestContext, payload: Record<string, unknown>) {
  const res = await request.post('/api/pos/transactions', { data: payload })
  expect(res.ok(), await res.text()).toBeTruthy()
  const body = await res.json()
  if (body.releaseFormRequestId) {
    const approve = await request.post(
      `/api/pos/release-form-requests/${body.releaseFormRequestId}/approve`,
      { data: { reviewNotes: 'E2E X-Deal memo' } }
    )
    expect(approve.ok(), await approve.text()).toBeTruthy()
    return (await approve.json()).createdTransactionId as string
  }
  return body.id as string
}

async function createSale(
  request: APIRequestContext,
  base: Pick<Fixtures, 'itemId' | 'itemName' | 'sessionId' | 'financingTermId'>,
  kind: 'x-deal' | 'ordinary'
): Promise<Sale> {
  const customer =
    kind === 'x-deal'
      ? await createCustomer(request, 'XDeal')
      : await createCustomer(request, 'Ordinary', {
          // Government institutional — the one ordinary installment sale that
          // needs no credit application.
          customerType: 'business',
          businessCategory: 'government',
          companyName: `${PREFIX} Gov Office`,
        })
  const transactionId = await postSale(request, {
    sessionId: base.sessionId,
    customerId: customer.id,
    salesInvoiceNumber: `SI-XDMEMO-${kind}-${Date.now()}`,
    subtotal: PRICE,
    totalAmount: PRICE,
    currency: 'PHP',
    ...(kind === 'x-deal' ? { isXDeal: true, xDealReference: `XD-REF-MEMO-${Date.now()}` } : {}),
    lines: [
      {
        itemId: base.itemId,
        itemName: base.itemName,
        quantity: 1,
        unitPrice: PRICE,
        invoiceType: 'installment',
        installmentProvider: 'inhouse',
        financingTermId: base.financingTermId,
        downPayment: kind === 'x-deal' ? 0 : PRICE * 0.1,
      },
    ],
  })
  return { customerId: customer.id, customerName: customer.name, transactionId }
}

async function installmentAccountOf(request: APIRequestContext, customerId: string) {
  const body = await (
    await request.get('/api/crm/installment-accounts', { params: { customerId } })
  ).json()
  return ((body.data ?? body) as { id: string; customerId: string }[]).find(
    (a) => a.customerId === customerId
  )!
}

/** X-Deal offset is its own page, reached from the Credit Memos list. */
async function openXDealPage(page: Page) {
  await gotoReady(page, '/accounting/credit-memos')
  await page.getByRole('link', { name: 'X-Deal offset' }).click()
  await expect(page).toHaveURL(/\/accounting\/credit-memos\/x-deal$/, { timeout: 15_000 })
  await expect(page.getByLabel('X-Deal sale')).toBeVisible({ timeout: 15_000 })
}

test.describe.serial('Credit Memos — X-Deal offset (Scenario 67)', () => {
  test.beforeAll(async ({ playwright }, testInfo) => {
    const request = await ownerRequest(playwright, testInfo.project.use.baseURL!)
    await sweepE2ECustomers(request, PREFIX)
    const branches = (await (await request.get('/api/branches?limit=200')).json()).data as {
      id: string
      name: string
    }[]
    const branchId = branches.find((b) => b.name === BRANCH)!.id
    const item = await createStockedItem(request, branchId)
    const sessionId = await openSession(request, branchId)
    const terms = (await (await request.get('/api/pos/financing-terms')).json()) as {
      id: string
      isActive?: boolean
    }[]
    const financingTermId = (terms.find((t) => t.isActive !== false) ?? terms[0]).id
    const base = { ...item, sessionId, financingTermId }
    fx = {
      ...base,
      xDeal: await createSale(request, base, 'x-deal'),
      ordinary: await createSale(request, base, 'ordinary'),
    }
    await request.dispose()
  })

  test.afterAll(async ({ playwright }, testInfo) => {
    const request = await ownerRequest(playwright, testInfo.project.use.baseURL!)
    await deleteCustomers(request, createdCustomerIds)
    if (fx) await request.delete(`/api/inventory/items/${fx.itemId}`).catch(() => {})
    await request.dispose()
  })

  test('XD-F12 / XD-F13: the picker lists only open X-Deal sales, and the JE preview matches what the backend will post', async ({
    page,
  }) => {
    await openXDealPage(page)
    const picker = page.getByLabel('X-Deal sale')
    await expect(picker.locator('option', { hasText: fx.xDeal.customerName })).toHaveCount(1)
    await expect(picker.locator('option', { hasText: fx.ordinary.customerName })).toHaveCount(0)

    const value = await picker
      .locator('option', { hasText: fx.xDeal.customerName })
      .getAttribute('value')
    await picker.selectOption(value!)

    const preview = await (
      await page.request.get('/api/credit-memos/x-deal/preview', {
        params: { posTransactionId: fx.xDeal.transactionId },
      })
    ).json()
    const peso = (n: number) => n.toLocaleString('en-PH', { minimumFractionDigits: 2 })
    const je = page.getByTestId('x-deal-je-preview')
    await expect(je.getByTestId('je-ar')).toContainText(peso(preview.outstanding))
    await expect(je.getByTestId('je-clearing')).toContainText(peso(preview.clearing))
    await expect(je.getByTestId('je-unearned')).toContainText(peso(preview.unearnedInterest))
  })

  test('XD-F14 / XD-F15: a double-clicked Issue creates one memo, and the ledger reads "Settled — X-Deal credit memo"', async ({
    page,
  }) => {
    await openXDealPage(page)
    const picker = page.getByLabel('X-Deal sale')
    const value = await picker
      .locator('option', { hasText: fx.xDeal.customerName })
      .getAttribute('value')
    await picker.selectOption(value!)
    await page.getByLabel('Reason').fill('Billboard space, E2E')
    await expect(page.getByTestId('je-ar')).toBeVisible()

    // Not clickStable — this issues a real memo.
    await page.getByRole('button', { name: 'Issue X-Deal memo' }).dblclick()
    await expect(page.getByText(/X-Deal memo .+ issued/)).toBeVisible({ timeout: 15_000 })
    await expect(page).toHaveURL(/\/accounting\/credit-memos$/, { timeout: 15_000 })

    const memos = (
      await (
        await page.request.get('/api/credit-memos', { params: { customerId: fx.xDeal.customerId } })
      ).json()
    ).items as { memoNumber: string; type: string; status: string }[]
    const xDealMemos = memos.filter((m) => m.type === 'x_deal')
    expect(xDealMemos).toHaveLength(1)
    const memoNumber = xDealMemos[0].memoNumber

    // The list shows it as an X-Deal memo.
    const row = page.locator('tr', { hasText: memoNumber })
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row.getByText('X-Deal offset')).toBeVisible()

    // …and it's gone from the picker.
    await page.getByRole('link', { name: 'X-Deal offset' }).click()
    await expect(page.getByLabel('X-Deal sale')).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByLabel('X-Deal sale').locator('option', { hasText: fx.xDeal.customerName })
    ).toHaveCount(0)
    await page.getByRole('link', { name: 'Cancel' }).click()
    await expect(page).toHaveURL(/\/accounting\/credit-memos$/, { timeout: 15_000 })

    const account = await installmentAccountOf(page.request, fx.xDeal.customerId)
    await gotoReady(page, `/crm/customers/${fx.xDeal.customerId}/installments/${account.id}`)
    await expect(page.getByTestId('ledger-status')).toHaveText(
      `Settled — X-Deal credit memo ${memoNumber}`,
      { timeout: 15_000 }
    )
    await expect(page.getByText('X-Deal credit memo', { exact: true })).toBeVisible()
  })

  test('XD-F16: voiding the X-Deal memo from the list reopens the account', async ({ page }) => {
    const memos = (
      await (
        await page.request.get('/api/credit-memos', { params: { customerId: fx.xDeal.customerId } })
      ).json()
    ).items as { memoNumber: string; type: string; status: string }[]
    const memo = memos.find((m) => m.type === 'x_deal' && m.status === 'ISSUED')!

    await gotoReady(page, '/accounting/credit-memos')
    const row = page.locator('tr', { hasText: memo.memoNumber })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.getByRole('button', { name: 'Void credit memo' }).click()
    // The app's own ConfirmDialog, not the browser's confirm().
    await expect(page.getByText(`Void X-Deal memo ${memo.memoNumber}?`)).toBeVisible()
    await page.getByRole('button', { name: 'Void memo' }).click()
    await expect(page.getByText('Memo voided')).toBeVisible({ timeout: 15_000 })

    const account = await installmentAccountOf(page.request, fx.xDeal.customerId)
    await gotoReady(page, `/crm/customers/${fx.xDeal.customerId}/installments/${account.id}`)
    await expect(page.getByTestId('ledger-status')).toHaveText('Active', { timeout: 15_000 })
  })

  test('XD-F17: the ordinary New Credit Memo dialog offers no X-Deal type', async ({ page }) => {
    await gotoReady(page, '/accounting/credit-memos')
    await page.getByRole('button', { name: 'New Credit Memo' }).click()
    await expect(page.getByText('Issue Credit Memo').first()).toBeVisible()
    // The X-Deal dialog isn't open, so any X-Deal option would be the
    // ordinary dialog's own type list.
    await expect(page.locator('option', { hasText: /X-Deal/ })).toHaveCount(0)
  })
})

test.describe('Credit Memos — X-Deal offset permission (Scenario 67)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('XD-F18: Branch Manager sees ordinary credit memos but no "X-Deal offset"', async ({
    page,
  }) => {
    await loginAs(page, BRANCH_MANAGER_EMAIL, DEV_PASSWORD)
    await gotoReady(page, '/accounting/credit-memos')
    await expect(page.getByRole('button', { name: 'New Credit Memo' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('link', { name: 'X-Deal offset' })).toHaveCount(0)
    // …and can't reach the page by URL either.
    await gotoReady(page, '/accounting/credit-memos/x-deal')
    await expect(page).toHaveURL(/\/403/, { timeout: 15_000 })
  })
})
