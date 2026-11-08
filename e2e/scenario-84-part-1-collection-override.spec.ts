import { test, expect, type Page } from '@playwright/test'
import { fillStable } from './utils'
import {
  OWNER_STATE,
  createInstallmentPlan,
  createPlanFixtures,
  deletePlanFixtures,
  dueRow,
  openCustomerOnCollections,
  type PlanFixtures,
} from './collections-plan'
// Scenario 84 Part 1 (DC-01 / CL-04), reduced after the "Override current
// date" control was removed from Collections. What is left is the Payment date
// field inside the payment panel: picking an earlier day on an open session
// leaves the receipt dated today and only judges rebate/penalty lateness as of
// that day. That the saved date then lands on the right report and ledger is
// the backend's scenario-84-part-1-collection-penalty e2e.
//
// The test itself is read-only: nothing is collected. The plan it looks at is
// built in beforeAll through checkout (collections-plan.ts), so a freshly
// seeded test DB, which has no open due, still runs it instead of skipping.
// Building it also leaves Bago with an open session, so S84-FE-1.4 always
// exercises the on-session branch.

const PREFIX = 'E2E S84 Override'

const localDay = (offsetDays = 0): string => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('en-CA')
}

// The panel's own Payment date field is the only date input on the screen.
const paymentDateInput = (page: Page) => page.locator('input[type="date"][required]')

test.describe('Scenario 84 Part 1 — Payment date on an open session', () => {
  let customerName: string
  let fx: PlanFixtures | undefined

  test.beforeAll(async ({ browser }, testInfo) => {
    test.setTimeout(180_000)
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      storageState: OWNER_STATE,
    })
    fx = await createPlanFixtures(context.request, PREFIX)
    const page = await context.newPage()
    customerName = (await createInstallmentPlan(page, fx, 'S84')).name
    await context.close()
  })

  test.afterAll(async ({ playwright }, testInfo) => {
    const request = await playwright.request.newContext({
      baseURL: testInfo.project.use.baseURL,
      storageState: OWNER_STATE,
    })
    await deletePlanFixtures(request, fx)
    await request.dispose()
  })

  async function tickFirstDue(page: Page) {
    await openCustomerOnCollections(page, customerName)
    const due = dueRow(page, 1)
    await expect(due).toBeVisible({ timeout: 15_000 })
    await due.getByRole('checkbox').check()
    await expect(paymentDateInput(page)).toBeVisible({ timeout: 10_000 })
  }

  test('S84-FE-1.4: on an open session an earlier Payment date only judges on time or late — the receipt stays today', async ({
    page,
  }) => {
    // Option 1 (2026-11-05). beforeAll opened a Bago session, so the screen
    // attaches the collection to it: the receipt is today's, and the Payment
    // date only decides on time or late.
    await tickFirstDue(page)
    await expect(paymentDateInput(page)).toHaveValue(localDay())
    await expect(page.getByText('Rebate / penalty as of')).toBeVisible()
    // On today itself there is nothing to assess as of: no note.
    await expect(page.getByTestId('collection-assessed-as-of')).toHaveCount(0)

    const yesterday = localDay(-1)
    await fillStable(paymentDateInput(page), yesterday)
    await expect(paymentDateInput(page)).toHaveValue(yesterday)
    const note = page.getByTestId('collection-assessed-as-of')
    await expect(note).toBeVisible()
    await expect(note).toContainText('dated today')
  })
})
