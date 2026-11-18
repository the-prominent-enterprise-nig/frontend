import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { gotoReady } from './utils'
import {
  OWNER_STATE,
  PLAN_BRANCH,
  createInstallmentPlan,
  createPlanFixtures,
  deletePlanFixtures,
  fillCrNumber,
  fillMoney,
  openCustomerOnCollections,
  tickDue,
  type PlanFixtures,
} from './collections-plan'

// POS Collections — Stub owner. Every collection's CR comes off a receipt
// booklet (stub) that is either the office's own or a field collector's. The
// Collect Payment panel asks which (Office | Field); a Field stub names the
// collector, picked from the branch's active collectors. The Daily Collection
// Report then prints the CR under OFFICE or FIELD by it, and the CR number is
// required on every collection.
//
// One plan, its first due collected twice for ₱1 on the same day (an open due
// takes an additional payment, see pos-collections-same-day-guard): once on an
// Office stub, once on a Field stub.

const PREFIX = 'E2E StubOwner'
const STUB_PREFIX = 'E2E-STUB'
// Underscored like the client's own area codes; the picker shows spaces.
const AREA = 'E2E_Stub_North'
const AREA_SHOWN = 'E2E Stub North'

const collect = (page: Page) => page.getByRole('button', { name: 'Collect payment' })
const panelHeading = (page: Page) => page.getByRole('heading', { name: 'Collect Payment' })
const stubOwner = (page: Page) => page.getByTestId('collection-stub-owner')
const stubOption = (page: Page, label: 'Office' | 'Field') =>
  stubOwner(page).getByRole('radio', { name: label, exact: true })
const collectorInput = (page: Page) => page.getByLabel('Collector', { exact: true })
const issues = (page: Page) => page.getByTestId('collection-issues')

type CollectorFixture = { id: string; name: string }

/** Deactivates collectors an earlier run left (ones on a receipt can't be
 * deleted), so the picker only lists this run's. */
async function sweepCollectors(request: APIRequestContext): Promise<void> {
  const res = await request.get('/api/crm/collectors', { params: { limit: 200 } })
  const list = ((await res.json()).data ?? []) as { id: string; stubNumber: string }[]
  for (const c of list.filter((c) => c.stubNumber.startsWith(STUB_PREFIX))) {
    await retireCollector(request, c.id)
  }
}

async function retireCollector(request: APIRequestContext, id: string): Promise<void> {
  const deleted = await request.delete(`/api/crm/collectors/${id}`)
  if (!deleted.ok()) {
    await request.patch(`/api/crm/collectors/${id}`, { data: { status: 'inactive' } })
  }
}

async function createCollector(
  request: APIRequestContext,
  branchId: string
): Promise<CollectorFixture> {
  const stamp = Date.now()
  const name = `${PREFIX} Collector ${stamp}`
  const res = await request.post('/api/crm/collectors', {
    data: { stubNumber: `${STUB_PREFIX}-${stamp}`, name, branchId, area: AREA },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  return { id: ((await res.json()) as { id: string }).id, name }
}

/** Ticks the first due and types ₱1 — enough to collect, never the whole due. */
async function startCollecting(page: Page, customerName: string): Promise<void> {
  await openCustomerOnCollections(page, customerName)
  await tickDue(page, 1)
  await fillMoney(page.getByTestId('collection-amount-0'), 1)
}

async function pickCollector(page: Page, collector: CollectorFixture): Promise<void> {
  await collectorInput(page).click()
  await page.getByTestId('searchable-select-option').filter({ hasText: collector.name }).click()
  await expect(collectorInput(page)).toHaveValue(`${collector.name} · ${AREA_SHOWN}`)
}

async function submit(page: Page): Promise<void> {
  await collect(page).click()
  await expect(panelHeading(page)).not.toBeVisible({ timeout: 20_000 })
}

test.describe('POS Collections — Stub owner', () => {
  // Each test builds on the collections the one before it took.
  test.describe.configure({ mode: 'serial' })
  let fx: PlanFixtures | undefined
  let collector: CollectorFixture
  let customerName: string
  let officeCr: string
  let fieldCr: string

  test.beforeAll(async ({ browser }, testInfo) => {
    test.setTimeout(180_000)
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      storageState: OWNER_STATE,
    })
    await sweepCollectors(context.request)
    fx = await createPlanFixtures(context.request, PREFIX)
    collector = await createCollector(context.request, fx.branchId)
    const page = await context.newPage()
    customerName = (await createInstallmentPlan(page, fx, 'S1')).name
    await context.close()
  })

  test.afterAll(async ({ playwright }, testInfo) => {
    const request = await playwright.request.newContext({
      baseURL: testInfo.project.use.baseURL,
      storageState: OWNER_STATE,
    })
    if (collector) await retireCollector(request, collector.id)
    await deletePlanFixtures(request, fx)
    await request.dispose()
  })

  test('SO-1: Stub owner starts on Office; Field asks for one of the branch’s collectors, shown without underscores', async ({
    page,
  }) => {
    await startCollecting(page, customerName)

    await expect(stubOption(page, 'Office')).toHaveAttribute('aria-checked', 'true')
    await expect(collectorInput(page)).toHaveCount(0)

    await stubOption(page, 'Field').click()
    await expect(stubOption(page, 'Field')).toHaveAttribute('aria-checked', 'true')
    await collectorInput(page).click()
    await expect(
      page.getByTestId('searchable-select-option').filter({ hasText: collector.name })
    ).toHaveText(`${collector.name} · ${AREA_SHOWN}`)
    await page.keyboard.press('Escape')

    // Field with no collector: Collect payment lists it and sends nothing.
    await fillCrNumber(page, 'SO1')
    await collect(page).click()
    await expect(issues(page)).toContainText('Collector (Field stub)')
    await expect(panelHeading(page)).toBeVisible()

    // Picking one clears it; back on Office there is nothing to pick.
    await pickCollector(page, collector)
    await expect(issues(page)).toHaveCount(0)
    await stubOption(page, 'Office').click()
    await expect(collectorInput(page)).toHaveCount(0)
    await page.getByRole('button', { name: 'Clear selection' }).click()
  })

  test('SO-2: the CR number is required — Collect payment lists it until one is typed', async ({
    page,
  }) => {
    await startCollecting(page, customerName)
    await collect(page).click()
    await expect(issues(page)).toContainText('CR number')
    await expect(page.getByTestId('collection-cr-number')).toHaveClass(/border-red-400/)

    officeCr = await fillCrNumber(page, 'SO-OFFICE')
    await expect(issues(page)).toHaveCount(0)
    // Recorded on an Office stub — the default.
    await submit(page)
  })

  test('SO-3: a Field stub collection is recorded with its collector', async ({ page }) => {
    await startCollecting(page, customerName)
    await stubOption(page, 'Field').click()
    await pickCollector(page, collector)
    fieldCr = await fillCrNumber(page, 'SO-FIELD')
    await submit(page)
  })

  test('SO-4: the Daily Collection Report prints the Office stub CR under OFFICE and the Field stub CR under FIELD', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/daily-collection')
    const branch = page.getByRole('button', { name: PLAN_BRANCH, exact: true }).first()
    await expect(branch).toBeVisible({ timeout: 30_000 })
    await branch.click()
    await expect(page.getByRole('heading', { name: 'Daily Collection Report' })).toBeVisible()

    const office = page.getByTestId('ledger-office')
    const field = page.getByTestId('ledger-field')
    await expect(office.filter({ hasText: officeCr })).toHaveCount(1, { timeout: 20_000 })
    await expect(field.filter({ hasText: fieldCr })).toHaveCount(1)
    // Each CR sits in its own column only.
    await expect(field.filter({ hasText: officeCr })).toHaveCount(0)
    await expect(office.filter({ hasText: fieldCr })).toHaveCount(0)
  })
})
