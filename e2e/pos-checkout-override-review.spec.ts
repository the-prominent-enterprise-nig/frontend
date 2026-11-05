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
} from './utils'

// Scenario 71 Part 4 — the Price Override Log (it was the Override Review).
// Every price override the floor took leaves an entry, and the page is a record
// of them: nothing is approved, rejected or signed off, and there is no PIN
// anywhere (ticket "Remove approval in Override" / POS-22). Head Office reads
// every branch over any period. The backend rules are covered by
// backend/test/pos-override-review.e2e-spec.ts (OR-01…); this spec covers the
// page. Case IDs (OR-F…) match
// docs/scenario-71-price-override-end-of-day-review-plan.md where they survive.
//
// The sales are posted through the API so the page is exercised, not checkout
// (Part 1's spec already covers the counter). Each sale is a price override on
// a fresh item this spec builds and prices on its own list.

const PREFIX = 'E2E OverrideReview'
// Not Bago: backend/test/pos-override-review.e2e-spec.ts runs its own sales there.
const BRANCH = 'Sagay'
const LIST_PRICE = 12000
// 16.7% under list — past the default 10% flag threshold.
const DEEP_PRICE = 10000
// 0.8% under list — an override, but not flagged.
const SHALLOW_PRICE = 11900

type Fixtures = {
  itemId: string
  itemName: string
  priceUseTypeId: string
  priceListId: string
  priceListItemId: string
  branchId: string
  sessionId: string
  reasonId: string
}

type Sale = { id: string; si: string }

let fx: Fixtures
let deepSale: Sale
let shallowSale: Sale
let today: string
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
      sku: `E2E-OR71-${stamp}`,
      name: itemName,
      baseUnitId,
      isSerialTracked: false,
      sellingPrice: LIST_PRICE,
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
      notes: 'E2E override review fixture stock',
      lines: [{ itemId: item.id, expectedQty: 0, actualQty: 50 }],
    },
  })
  expect(adjustRes.ok(), await adjustRes.text()).toBeTruthy()
  const adjustment = await adjustRes.json()
  for (const step of ['confirm', 'investigate', 'approve']) {
    const stepRes = await request.patch(`/api/inventory/adjustments/${adjustment.id}/${step}`)
    expect(stepRes.ok(), await stepRes.text()).toBeTruthy()
  }

  const putRes = await request.post('/api/inventory/price-use-types', {
    data: { name: `${PREFIX} PU ${stamp}` },
  })
  expect(putRes.ok(), await putRes.text()).toBeTruthy()
  const priceUseType = await putRes.json()

  const listRes = await request.post('/api/inventory/price-lists', {
    data: { name: `${PREFIX} List ${stamp}`, priceUseTypeId: priceUseType.id },
  })
  expect(listRes.ok(), await listRes.text()).toBeTruthy()
  const priceList = await listRes.json()
  const itemsRes = await request.post(`/api/inventory/price-lists/${priceList.id}/items`, {
    data: { items: [{ itemId: item.id, price: LIST_PRICE }] },
  })
  expect(itemsRes.ok(), await itemsRes.text()).toBeTruthy()
  const approveRes = await request.post(`/api/inventory/price-lists/${priceList.id}/approve`, {
    data: {},
  })
  expect(approveRes.ok(), await approveRes.text()).toBeTruthy()
  const fullList = await (await request.get(`/api/inventory/price-lists/${priceList.id}`)).json()
  const priceListItemId = (fullList.items as { id: string; itemId: string }[]).find(
    (i) => i.itemId === item.id
  )!.id

  const reasons = (await (
    await request.get('/api/pos/override-reasons?activeOnly=true')
  ).json()) as {
    id: string
  }[]

  return {
    itemId: item.id,
    itemName,
    priceUseTypeId: priceUseType.id,
    priceListId: priceList.id,
    priceListItemId,
    branchId,
    sessionId: await ensureOpenSession(request, branchId),
    reasonId: reasons[0].id,
  }
}

async function ensureOpenSession(request: APIRequestContext, branchId: string): Promise<string> {
  const terminals = (await (
    await request.get('/api/pos/terminals', { params: { branchId } })
  ).json()) as { id: string; status: string }[]
  const terminal = terminals.find((t) => t.status === 'active') ?? terminals[0]
  const open = (await (
    await request.get('/api/pos/sessions', { params: { terminalId: terminal.id, status: 'open' } })
  ).json()) as { id: string }[]
  // Reused rather than closed: closing needs the declared cash to match the
  // expected amount, so a rerun would otherwise fail.
  if (open.length) return open[0].id
  const res = await request.post('/api/pos/sessions/open', {
    data: { terminalId: terminal.id, openingCash: 1000 },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  return (await res.json()).id as string
}

async function createCustomer(request: APIRequestContext, label: string): Promise<string> {
  const res = await request.post('/api/crm/customers', {
    data: {
      name: `${PREFIX} ${label} ${Date.now()}`,
      customerType: 'individual',
      phone: `0917${Date.now().toString().slice(-7)}`,
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const customer = await res.json()
  createdCustomerIds.push(customer.id)
  return customer.id as string
}

/** A cash sale of one unit whose price was typed over the list price. */
async function sell(request: APIRequestContext, price: number, label: string): Promise<Sale> {
  const si = `SI-OR71F-${Date.now()}-${label}`
  const res = await request.post('/api/pos/transactions', {
    data: {
      sessionId: fx.sessionId,
      customerId: await createCustomer(request, label),
      salesInvoiceNumber: si,
      subtotal: price,
      totalAmount: price,
      currency: 'PHP',
      exceptionReasonId: fx.reasonId,
      exceptionNote: `Kilala ni Boss ${label}`,
      lines: [
        {
          itemId: fx.itemId,
          itemName: fx.itemName,
          quantity: 1,
          unitPrice: price,
          pricingMode: 'inclusive',
          priceUseTypeId: fx.priceUseTypeId,
          priceOverride: true,
          overriddenFromPriceListItemId: fx.priceListItemId,
        },
      ],
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  return { id: (await res.json()).id as string, si }
}

/** The local calendar day, the way the page keys it. */
function isoDayOffset(days: number): string {
  const now = new Date()
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days)
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`
}

const logUrl = (query = '') =>
  `/pos/override-review?branchId=${fx.branchId}${query ? `&${query}` : ''}`

const entryFor = (page: Page, si: string) =>
  page.getByTestId('override-entry').filter({ hasText: si })

/** The row is one line; the full receipt opens beneath it. */
async function openDetails(entry: Locator) {
  const toggle = entry.getByTestId('entry-toggle')
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  await expect(entry.getByTestId('entry-details')).toBeVisible()
}

test.describe.configure({ mode: 'serial' })

test.describe('POS Price Override Log — a record, nothing to approve (Scenario 71 Part 4)', () => {
  test.beforeAll(async ({ playwright }, testInfo) => {
    const request = await ownerRequest(playwright, testInfo.project.use.baseURL!)
    await sweepE2ECustomers(request, PREFIX)
    await sweepE2EPriceLists(request, PREFIX)
    await sweepE2EPriceUseTypes(request, PREFIX)
    fx = await createFixtures(request)
    deepSale = await sell(request, DEEP_PRICE, 'deep')
    shallowSale = await sell(request, SHALLOW_PRICE, 'shallow')
    today = isoDayOffset(0)
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

  test("OR-F01: the page lists the period's overrides with the figures, under the new name", async ({
    page,
  }) => {
    await gotoReady(page, logUrl())

    await expect(page.getByRole('heading', { name: 'Price Override Log' })).toBeVisible({
      timeout: 20_000,
    })
    for (const sale of [deepSale, shallowSale]) {
      await expect(entryFor(page, sale.si)).toBeVisible()
    }

    const deep = entryFor(page, deepSale.si)
    // The line itself: what was charged, the discount in pesos and percent, the
    // date it was rung up, its branch and customer, and who rang it.
    await expect(deep).toContainText('₱10,000.00')
    await expect(deep).toContainText('₱2,000.00')
    await expect(deep.getByTestId('entry-date')).toContainText(/[A-Z][a-z]{2} \d{1,2} \d{2}:\d{2}/)
    await expect(deep.getByTestId('entry-branch')).toHaveText(BRANCH)
    await expect(deep.getByTestId('entry-customer')).toContainText(`${PREFIX} deep`)
    await expect(deep).toContainText('Over 10%')

    // Opening it shows the whole receipt.
    await openDetails(deep)
    await expect(deep).toContainText('₱12,000.00') // the list price it started from
    await expect(deep).toContainText('16.7% below')
    await expect(deep).toContainText('Kilala ni Boss deep')
    const details = deep.getByTestId('entry-details')
    await expect(details).toContainText('Sale total')
    await expect(details).toContainText('Cashier')
    await expect(details).toContainText('₱10,000.00')
    // A cash sale has no installment account to open.
    await expect(deep.getByTestId('entry-ia-link')).toHaveCount(0)

    const entries = Number(await page.getByTestId('kpi-entries').locator('p').nth(1).textContent())
    expect(entries).toBeGreaterThanOrEqual(2)

    // The sidebar row and the tab carry the new name.
    await expect(page.getByRole('link', { name: 'Price Override Log' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /^Override Review/ })).toHaveCount(0)
  })

  test('OR-F02: Flagged shows only what crossed the threshold or skipped a rule', async ({
    page,
  }) => {
    await gotoReady(page, logUrl())
    await expect(entryFor(page, deepSale.si)).toBeVisible({ timeout: 20_000 })

    await expect(entryFor(page, deepSale.si)).toContainText('Over 10%')
    await expect(entryFor(page, shallowSale.si)).not.toContainText(/Over \d+%/)

    await page.getByTestId('tab-flagged').click()
    await expect(entryFor(page, deepSale.si)).toBeVisible()
    await expect(entryFor(page, shallowSale.si)).toHaveCount(0)

    await page.getByTestId('tab-all').click()
    await expect(entryFor(page, shallowSale.si)).toBeVisible()
  })

  test('OR-F03: nothing to approve — no Approve, Reject, Approve all or Sign off, no Pending, no PIN, no badge', async ({
    page,
  }) => {
    await gotoReady(page, logUrl())
    await expect(entryFor(page, deepSale.si)).toBeVisible({ timeout: 20_000 })

    for (const id of ['entry-approve', 'entry-reject', 'entry-change', 'approve-all', 'sign-off']) {
      await expect(page.getByTestId(id)).toHaveCount(0)
    }
    await expect(page.getByTestId('tab-pending')).toHaveCount(0)
    await expect(page.getByTestId('kpi-pending')).toHaveCount(0)
    await expect(page.getByTestId('kpi-rejected')).toHaveCount(0)
    await expect(page.getByTestId('override-signoffs')).toHaveCount(0)
    await expect(page.getByTestId('pending-days')).toHaveCount(0)
    await expect(page.getByText(/Decision|Sign off|Approve all/)).toHaveCount(0)
    await expect(page.getByLabel(/PIN/i)).toHaveCount(0)

    // No pending-count badge on the sidebar's Approvals & Reviews row.
    await expect(
      page.locator('aside').getByRole('link', { name: /^Approvals & Reviews$/ })
    ).toBeVisible()

    // And the old routes are gone.
    for (const [method, url] of [
      ['post', `/api/pos/override-review/${deepSale.id}/decide`],
      ['post', '/api/pos/override-review/approve-all'],
      ['post', '/api/pos/override-review/sign-off'],
      ['get', '/api/pos/override-review/pending-count'],
    ] as const) {
      const res = await page.request[method](url, method === 'post' ? { data: {} } : undefined)
      expect(res.status(), url).toBe(404)
    }
  })

  test('OR-F04: the log reads a period — From and To keep in order, a single day is a day, and a link opens on one', async ({
    page,
  }) => {
    await gotoReady(page, logUrl())
    await expect(entryFor(page, deepSale.si)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('log-from')).toHaveValue(today)
    await expect(page.getByTestId('log-to')).toHaveValue(today)

    // A week up to today still has the sales (oldest first, so they sit at the end).
    await page.getByTestId('log-from').fill(isoDayOffset(-7))
    await expect(page.getByTestId('log-from')).toHaveValue(isoDayOffset(-7))
    await expect(entryFor(page, deepSale.si)).toBeVisible({ timeout: 20_000 })

    // To moves freely after From; moved back before it, To drags From along.
    await page.getByTestId('log-to').fill(isoDayOffset(-3))
    await expect(page.getByTestId('log-to')).toHaveValue(isoDayOffset(-3))
    await expect(page.getByTestId('log-from')).toHaveValue(isoDayOffset(-7))
    await page.getByTestId('log-to').fill(isoDayOffset(-9))
    await expect(page.getByTestId('log-from')).toHaveValue(isoDayOffset(-9))
    // That window is before today's sales, so they are not in it.
    await expect(entryFor(page, deepSale.si)).toHaveCount(0)
    await expect(page.getByTestId('override-empty')).toContainText('No exceptions')

    // A link opens straight on a period.
    await gotoReady(page, logUrl(`from=${isoDayOffset(-2)}&to=${today}`))
    await expect(page.getByTestId('log-from')).toHaveValue(isoDayOffset(-2))
    await expect(entryFor(page, deepSale.si)).toBeVisible({ timeout: 20_000 })
  })

  test('OR-F05: the owner reads every branch and can narrow to one', async ({ page }) => {
    // No branch in the link: every branch together.
    await gotoReady(page, '/pos/override-review')
    await expect(page.getByRole('heading', { name: 'Price Override Log' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText('— all branches')).toBeVisible()
    await expect(entryFor(page, deepSale.si)).toBeVisible({ timeout: 20_000 })

    // Narrow to the branch the sales were rung up at.
    const filter = page.getByTestId('branch-filter').getByRole('textbox')
    const pickBranch = async (name: RegExp) => {
      await filter.click()
      await filter.fill(name.source.replace(/[\^$]/g, ''))
      await page
        .locator('[data-testid="searchable-select-option"]', { hasText: name })
        .first()
        .click()
    }
    await pickBranch(new RegExp(`^${BRANCH}$`))
    await expect(page.getByText(`— ${BRANCH}`)).toBeVisible()
    await expect(entryFor(page, deepSale.si)).toBeVisible()
    const branches = await page.getByTestId('entry-branch').allTextContents()
    expect(branches.length).toBeGreaterThan(0)
    expect(new Set(branches)).toEqual(new Set([BRANCH]))

    // Another branch has none of these sales.
    await pickBranch(/^Bago/)
    await expect(entryFor(page, deepSale.si)).toHaveCount(0)
  })

  test('OR-F07: General settings carries the flag threshold, and a saved value is what the next sale is flagged against', async ({
    page,
    playwright,
  }, testInfo) => {
    // Driven through the settings page itself: /api/pos/config/active comes
    // back empty for this account (the page falls back to a tenant lookup), so
    // the page is the one reliable reader of the setting.
    const input = page.getByLabel('Price Override Flag Threshold (%)')
    const saveFlagPct = async (value: string) => {
      await fillStable(input, value)
      await page.getByRole('button', { name: /Save/ }).click()
      await expect(page.getByText('Configuration saved.')).toBeVisible()
    }

    await gotoReady(page, '/pos/settings/general')
    await expect(input).toBeVisible({ timeout: 20_000 })
    const original = await input.inputValue()

    try {
      // 20% — the 16.7% override that is flagged at 10% no longer is.
      await saveFlagPct('20')
      await gotoReady(page, '/pos/settings/general')
      await expect(input).toHaveValue('20')

      const request = await ownerRequest(playwright, testInfo.project.use.baseURL!)
      const sale = await sell(request, DEEP_PRICE, 'threshold')
      await request.dispose()

      await gotoReady(page, logUrl())
      await expect(entryFor(page, sale.si)).toBeVisible({ timeout: 20_000 })
      await expect(entryFor(page, sale.si)).not.toContainText(/Over \d+%/)
    } finally {
      await gotoReady(page, '/pos/settings/general')
      await expect(input).toBeVisible({ timeout: 20_000 })
      await saveFlagPct(original === '' ? '10' : original)
    }
  })
})
