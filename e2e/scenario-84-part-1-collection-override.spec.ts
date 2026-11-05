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
// Scenario 84 Part 1 (DC-01 / CL-04) — the Collections screen's Payment date
// follows "Override current date", whenever the override is set.
//
// The panel used to seed its Payment date from the override once, when it
// opened: a cashier who ticked the dues FIRST and set the override after saw
// the amber "Viewing this screen as of …" banner move, while the Payment date
// stayed on today — so the collection saved on today, and never reached the
// overridden day's Collection Report or ledger row. That the saved date then
// lands on the right report and ledger is the backend's
// scenario-84-part-1-collection-penalty e2e.
//
// The tests themselves are read-only: nothing is collected. The plan they
// look at is built in beforeAll through checkout (collections-plan.ts), so a
// freshly seeded test DB, which has no open due, still runs every test
// instead of skipping. Building it also leaves Bago with an open session, so
// S84-FE-1.4 always exercises the on-session branch.

const PREFIX = 'E2E S84 Override'

const localDay = (offsetDays = 0): string => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('en-CA')
}

const overrideInput = (page: Page) => page.locator('input[type="date"]:not([required])')
// The panel's own field is the required one.
const paymentDateInput = (page: Page) => page.locator('input[type="date"][required]')

test.describe('Scenario 84 Part 1 — Payment date follows the date override', () => {
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

  test('S84-FE-1.1: an override set after ticking the dues moves the Payment date with it', async ({
    page,
  }) => {
    await tickFirstDue(page)
    await expect(paymentDateInput(page)).toHaveValue(localDay())

    const yesterday = localDay(-1)
    await fillStable(overrideInput(page), yesterday)
    await expect(page.getByText(/Viewing this screen as of/)).toBeVisible()
    await expect(paymentDateInput(page)).toHaveValue(yesterday)
  })

  test('S84-FE-1.2: changing the override again, then resetting it, keeps the Payment date in step', async ({
    page,
  }) => {
    await tickFirstDue(page)

    const threeDaysAgo = localDay(-3)
    await fillStable(overrideInput(page), localDay(-1))
    await fillStable(overrideInput(page), threeDaysAgo)
    await expect(paymentDateInput(page)).toHaveValue(threeDaysAgo)

    await page.getByRole('button', { name: 'Reset to today' }).click()
    await expect(page.getByText(/Viewing this screen as of/)).not.toBeVisible()
    await expect(paymentDateInput(page)).toHaveValue(localDay())
  })

  test('S84-FE-1.3: the ticked dues stay ticked when the override changes', async ({ page }) => {
    await tickFirstDue(page)
    await fillStable(overrideInput(page), localDay(-1))
    // The panel reopens for the new date, but over the same selection.
    await expect(
      page
        .locator('li')
        .filter({ has: page.getByRole('checkbox') })
        .first()
        .getByRole('checkbox')
    ).toBeChecked()
    await expect(paymentDateInput(page)).toBeVisible()
  })

  test('S84-FE-1.4: on an open session the override only judges on time or late — the receipt stays today', async ({
    page,
  }) => {
    // Option 1 (2026-11-05). beforeAll opened a Bago session, so the screen
    // attaches the collection to it: the receipt is today's, and the
    // override only decides on time or late.
    await tickFirstDue(page)
    await expect(page.getByText('Rebate / penalty as of')).toBeVisible()
    // On today itself there is nothing to assess as of: no note.
    await expect(page.getByTestId('collection-assessed-as-of')).toHaveCount(0)

    const yesterday = localDay(-1)
    await fillStable(overrideInput(page), yesterday)
    await expect(paymentDateInput(page)).toHaveValue(yesterday)
    const note = page.getByTestId('collection-assessed-as-of')
    await expect(note).toBeVisible()
    await expect(note).toContainText('dated today')
  })
})
