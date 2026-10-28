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

// Scenario 71 Part 4 — the end-of-day Override Review. Every price override
// the floor took leaves an entry; a manager approves or rejects each (a
// rejection needs a note and reverses nothing) and signs the branch's day off.
// There is no PIN anywhere on the page. The backend rules are covered by
// backend/test/pos-override-review.e2e-spec.ts (OR-01…16); this spec covers the
// page that drives them. Case IDs (OR-F…) match
// docs/scenario-71-price-override-end-of-day-review-plan.md.
//
// The sales are posted through the API so the page is exercised, not checkout
// (Part 1's spec already covers the counter). Each sale is a price override on
// a fresh item this spec builds and prices on its own list.

const PREFIX = 'E2E OverrideReview'
// Not Bago: signing a day off is permanent, and Bago is B1 — the branch
// backend/test/pos-override-review.e2e-spec.ts reviews its own sales on. Nothing
// else touches Sagay. Each run signs off one more day there (the sale rolls on
// to the next open one), so the search for a sale's review day looks far ahead.
const BRANCH = 'Sagay'
const LIST_PRICE = 12000
// 16.7% under list — past the default 10% flag threshold.
const DEEP_PRICE = 10000
// 0.8% under list — an override, but not flagged.
const SHALLOW_PRICE = 11900
// 25% under list — flagged, and the one this spec rejects.
const REJECT_PRICE = 9000

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
let rejectSale: Sale
let reviewDay: string
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

function isoDayOffset(from: string, days: number): string {
  const [y, m, d] = from.split('-').map(Number)
  const at = new Date(y, m - 1, d + days)
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`
}

/** The review day a sale landed on — today, unless the branch already signed
 * that day off (an earlier run of this spec), which rolls it forward. */
async function findReviewDay(request: APIRequestContext, si: string): Promise<string> {
  const now = new Date()
  const today = isoDayOffset(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    0
  )
  for (let offset = 0; offset < 90; offset++) {
    const day = isoDayOffset(today, offset)
    const res = await request.get('/api/pos/override-review', {
      params: { date: day, branchId: fx.branchId },
    })
    const body = (await res.json()) as { entries?: { salesInvoiceNumber: string | null }[] }
    if (body.entries?.some((e) => e.salesInvoiceNumber === si)) return day
  }
  throw new Error(`No review day found for ${si}`)
}

const reviewUrl = (day: string) =>
  `/pos/override-review?date=${day}&branchId=${fx.branchId}&branchName=${BRANCH}`

const entryFor = (page: Page, si: string) =>
  page.getByTestId('override-entry').filter({ hasText: si })

/** The row is one line; the full receipt opens beneath it. */
async function openDetails(entry: Locator) {
  const toggle = entry.getByTestId('entry-toggle')
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  await expect(entry.getByTestId('entry-details')).toBeVisible()
}

test.describe.configure({ mode: 'serial' })

test.describe('POS Override Review — decide the day, sign it off (Scenario 71 Part 4)', () => {
  test.beforeAll(async ({ playwright }, testInfo) => {
    const request = await ownerRequest(playwright, testInfo.project.use.baseURL!)
    await sweepE2ECustomers(request, PREFIX)
    await sweepE2EPriceLists(request, PREFIX)
    await sweepE2EPriceUseTypes(request, PREFIX)
    fx = await createFixtures(request)
    deepSale = await sell(request, DEEP_PRICE, 'deep')
    shallowSale = await sell(request, SHALLOW_PRICE, 'shallow')
    rejectSale = await sell(request, REJECT_PRICE, 'reject')
    reviewDay = await findReviewDay(request, deepSale.si)
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

  test("OR-F01: the page lists the day's overrides with the figures, and the sidebar item shows what is pending", async ({
    page,
  }) => {
    await gotoReady(page, reviewUrl(reviewDay))

    await expect(page.getByRole('heading', { name: 'Override Review' })).toBeVisible({
      timeout: 20_000,
    })
    for (const sale of [deepSale, shallowSale, rejectSale]) {
      await expect(entryFor(page, sale.si)).toBeVisible()
    }

    const deep = entryFor(page, deepSale.si)
    await expect(deep).toHaveAttribute('data-status', 'pending')
    // The line itself: what was charged, the discount in pesos and percent, the
    // branch always (this page is filtered to one), and the customer in place of
    // the old Seller column.
    await expect(deep).toContainText('₱10,000.00')
    await expect(deep).toContainText('₱2,000.00')
    await expect(deep.getByTestId('entry-branch')).toHaveText(BRANCH)
    await expect(deep.getByTestId('entry-customer')).toContainText(`${PREFIX} deep`)
    await expect(deep).toContainText('Over 10%')
    await expect(deep).not.toContainText('Seller')

    // Opening it shows the whole receipt.
    await openDetails(deep)
    await expect(deep).toContainText('₱12,000.00') // the list price it started from
    await expect(deep).toContainText('16.7% below')
    await expect(deep).toContainText('Kilala ni Boss deep')
    const details = deep.getByTestId('entry-details')
    await expect(details).toContainText('Sale total')
    await expect(details).toContainText('₱10,000.00')
    // A cash sale has no installment account to open.
    await expect(deep.getByTestId('entry-ia-link')).toHaveCount(0)

    const entries = Number(await page.getByTestId('kpi-entries').locator('p').nth(1).textContent())
    expect(entries).toBeGreaterThanOrEqual(3)

    const nav = page.getByRole('link', { name: /Override Review/ }).first()
    await expect(nav).toBeVisible()
    // The pending count rides on the link as a badge.
    await expect(nav).toContainText(/\d+/)
  })

  test('OR-F02: Flagged shows only what crossed the threshold or skipped a rule; Pending shows what still waits', async ({
    page,
  }) => {
    await gotoReady(page, reviewUrl(reviewDay))
    await expect(entryFor(page, deepSale.si)).toBeVisible({ timeout: 20_000 })

    await expect(entryFor(page, deepSale.si)).toContainText('Over 10%')
    await expect(entryFor(page, shallowSale.si)).not.toContainText(/Over \d+%/)

    await page.getByTestId('tab-flagged').click()
    await expect(entryFor(page, deepSale.si)).toBeVisible()
    await expect(entryFor(page, rejectSale.si)).toBeVisible()
    await expect(entryFor(page, shallowSale.si)).toHaveCount(0)

    await page.getByTestId('tab-pending').click()
    await expect(entryFor(page, shallowSale.si)).toBeVisible()
  })

  test('OR-F03: Approve is one click — no PIN, no note — and the page says who decided', async ({
    page,
  }) => {
    await gotoReady(page, reviewUrl(reviewDay))
    const deep = entryFor(page, deepSale.si)
    await expect(deep).toBeVisible({ timeout: 20_000 })

    await deep.getByTestId('entry-approve').click()

    await expect(deep).toHaveAttribute('data-status', 'approved')
    // The Decision column: the status; the details say who and when.
    await expect(deep).toContainText('Approved')
    await openDetails(deep)
    await expect(deep.getByTestId('entry-decision')).toContainText(/^by \S/)
    // No PIN prompt came up at any point.
    await expect(page.getByLabel(/PIN/i)).toHaveCount(0)
  })

  test('OR-F04: Reject needs a note, and only records the decision — the sale stays', async ({
    page,
  }) => {
    await gotoReady(page, reviewUrl(reviewDay))
    const entry = entryFor(page, rejectSale.si)
    await expect(entry).toBeVisible({ timeout: 20_000 })

    await entry.getByTestId('entry-reject').click()
    const confirm = entry.getByTestId('reject-confirm')
    await expect(confirm).toBeDisabled()

    await entry.getByTestId('reject-note').fill('Discount too deep for this customer')
    await expect(confirm).toBeEnabled()
    await confirm.click()

    await expect(entry).toHaveAttribute('data-status', 'rejected')
    await openDetails(entry)
    await expect(entry.getByTestId('entry-decision')).toContainText(
      'Discount too deep for this customer'
    )

    // Nothing was reversed — the sale is still a completed sale.
    await page.waitForTimeout(500)
    const request = page.request
    const res = await request.get(`/api/pos/transactions/${rejectSale.id}`)
    expect(res.ok()).toBeTruthy()
    expect((await res.json()).status).not.toBe('voided')
  })

  test('OR-F05: sign-off waits for every decision; approve-all clears the rest; signing off locks the day', async ({
    page,
  }) => {
    await gotoReady(page, reviewUrl(reviewDay))
    await expect(entryFor(page, shallowSale.si)).toBeVisible({ timeout: 20_000 })

    // shallowSale is still pending, so the day cannot be signed off yet.
    await expect(entryFor(page, shallowSale.si)).toHaveAttribute('data-status', 'pending')
    await expect(page.getByTestId('sign-off')).toBeDisabled()

    await page.getByTestId('approve-all').click()
    await expect(entryFor(page, shallowSale.si)).toHaveAttribute('data-status', 'approved')
    await expect(page.getByTestId('approve-all')).toBeDisabled()

    await expect(page.getByTestId('sign-off')).toBeEnabled()
    await page.getByTestId('sign-off').click()

    await expect(page.getByTestId('override-signoffs')).toContainText('signed off')
    await expect(page.getByTestId('sign-off')).toBeDisabled()
    await expect(page.getByTestId('sign-off')).toContainText('Signed off')
    // Locked: nothing on the day can be decided any more.
    await expect(page.getByTestId('entry-approve')).toHaveCount(0)
    await expect(page.getByTestId('entry-reject')).toHaveCount(0)
    await expect(page.getByTestId('entry-change')).toHaveCount(0)
    await expect(page.getByLabel(/PIN/i)).toHaveCount(0)
  })

  test('OR-F06: a sale made after the sign-off lands on the next open day, not the locked one', async ({
    page,
    playwright,
  }, testInfo) => {
    const request = await ownerRequest(playwright, testInfo.project.use.baseURL!)
    const late = await sell(request, SHALLOW_PRICE, 'late')
    const lateDay = await findReviewDay(request, late.si)
    await request.dispose()

    expect(lateDay > reviewDay).toBeTruthy()

    await gotoReady(page, reviewUrl(reviewDay))
    await expect(page.getByTestId('override-signoffs')).toContainText('signed off', {
      timeout: 20_000,
    })
    await expect(entryFor(page, late.si)).toHaveCount(0)

    // The sidebar badge counts that waiting entry, so the signed day says
    // where it is — and the strip jumps there (latest day last).
    await expect(page.getByTestId('pending-days')).toBeVisible()
    await page.getByTestId('pending-day').last().click()
    await expect(page.getByLabel('Business date')).toHaveValue(lateDay)
    await expect(entryFor(page, late.si)).toBeVisible({ timeout: 20_000 })
    await expect(entryFor(page, late.si)).toHaveAttribute('data-status', 'pending')
    await expect(page.getByTestId('override-signoffs')).toHaveCount(0)

    // The same day opened straight from a link.
    await gotoReady(page, reviewUrl(lateDay))
    await expect(entryFor(page, late.si)).toBeVisible({ timeout: 20_000 })
  })
  test('OR-F08: the sidebar badge counts the branch the page is on — not every branch — and drops the moment an entry is decided', async ({
    page,
    playwright,
  }, testInfo) => {
    const request = await ownerRequest(playwright, testInfo.project.use.baseURL!)
    const sale = await sell(request, SHALLOW_PRICE, 'badge')
    const day = await findReviewDay(request, sale.si)
    const pending = async () =>
      (
        (await (
          await request.get('/api/pos/override-review/pending-count', {
            params: { branchId: fx.branchId },
          })
        ).json()) as { count: number }
      ).count
    const before = await pending()
    expect(before).toBeGreaterThanOrEqual(1)

    await gotoReady(page, reviewUrl(day))
    const nav = page.getByRole('link', { name: /Override Review/ }).first()
    await expect(entryFor(page, sale.si)).toBeVisible({ timeout: 20_000 })
    await expect(nav).toContainText(String(before))

    // No navigation: the page and the badge share one query.
    await entryFor(page, sale.si).getByTestId('entry-approve').click()
    await expect(entryFor(page, sale.si)).toHaveAttribute('data-status', 'approved')
    if (before - 1 > 0) {
      await expect(nav).toContainText(String(before - 1))
    } else {
      await expect(nav).not.toContainText(/\d/)
    }
    await request.dispose()
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
      const day = await findReviewDay(request, sale.si)
      await request.dispose()

      await gotoReady(page, reviewUrl(day))
      await expect(entryFor(page, sale.si)).toBeVisible({ timeout: 20_000 })
      await expect(entryFor(page, sale.si)).not.toContainText(/Over \d+%/)
    } finally {
      await gotoReady(page, '/pos/settings/general')
      await expect(input).toBeVisible({ timeout: 20_000 })
      await saveFlagPct(original === '' ? '10' : original)
    }
  })
})
