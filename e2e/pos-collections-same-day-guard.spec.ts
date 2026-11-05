import { test, expect, type Page } from '@playwright/test'
import {
  OWNER_STATE,
  createInstallmentPlan,
  createPlanFixtures,
  deletePlanFixtures,
  dueRow,
  fillMoney,
  openCustomerOnCollections,
  pesos,
  tickDue,
  type PlanFixtures,
} from './collections-plan'

// POS Collections — the same-day guard as the screen has it now. A due still
// open can be topped up again the same day: the panel says a payment was
// already collected today and that this one is an additional payment toward
// what is left, and lets it through (the backend only refuses a repeat
// same-date payment once the due is fully paid). A due paid in full loses its
// checkbox and shows a permanent "Paid" instead, so it cannot be collected
// again from here at all.
//
// The old "backdating is flagged" test is gone on purpose: with an open
// session the receipt is always dated today now (the override only judges on
// time or late), which S84-FE-1.4 and the backend's
// collections-override-assessed-date e2e cover.
//
// The plan is built through checkout (collections-plan.ts): the seed has no
// open dues, and a bare API sale now needs an approved credit application.

const PREFIX = 'E2E CollectionsGuard'

const collect = (page: Page) => page.getByRole('button', { name: 'Collect payment' })
const panelHeading = (page: Page) => page.getByRole('heading', { name: 'Collect Payment' })
const previewRow = (page: Page) => page.locator('table tbody tr').first()
const netCell = (page: Page) => previewRow(page).locator('td').nth(5)
const rebateBox = (page: Page) => previewRow(page).locator('td').nth(3).getByRole('checkbox')

async function collectAmount(page: Page, amount: number): Promise<void> {
  await fillMoney(page.getByTestId('collection-amount-0'), amount)
  await collect(page).click()
  await expect(panelHeading(page)).not.toBeVisible({ timeout: 20_000 })
}

test.describe('POS Collections — same-day payments on one due', () => {
  // The second test continues on the due the first one part-paid.
  test.describe.configure({ mode: 'serial' })
  let fx: PlanFixtures | undefined
  let customerName: string

  test.beforeAll(async ({ browser }, testInfo) => {
    test.setTimeout(180_000)
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      storageState: OWNER_STATE,
    })
    fx = await createPlanFixtures(context.request, PREFIX)
    const page = await context.newPage()
    customerName = (await createInstallmentPlan(page, fx, 'G1')).name
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

  test('a second payment on an open due the same day is let through, marked as an additional payment', async ({
    page,
  }) => {
    await openCustomerOnCollections(page, customerName)
    await tickDue(page, 1)
    // A payment that doesn't clear the whole due earns no rebate (the server
    // refuses it as rebate_exceeds_ppd), so a partial payment goes without.
    await rebateBox(page).uncheck()
    await collectAmount(page, 1)
    await expect(dueRow(page, 1)).toContainText('₱1.00 of', { timeout: 15_000 })

    await tickDue(page, 1)
    await expect(
      page.getByText('A payment was already collected on this plan on today')
    ).toBeVisible()
    await expect(page.getByText('recorded as an additional payment')).toBeVisible()
    await expect(collect(page)).toBeEnabled()
    await page.getByRole('button', { name: 'Clear selection' }).click()
  })

  // Runs after the test above, on the same due: what is left of it.
  test('paying a due in full takes away its checkbox and shows a permanent "Paid"', async ({
    page,
  }) => {
    await openCustomerOnCollections(page, customerName)
    await tickDue(page, 1)
    await collectAmount(page, pesos(await netCell(page).innerText()))

    const due1 = dueRow(page, 1)
    await expect(due1.getByTitle(/already fully paid/)).toBeVisible({ timeout: 15_000 })
    await expect(due1.getByRole('checkbox')).toHaveCount(0)
    // The next due is untouched and still collectable.
    await expect(dueRow(page, 2).getByRole('checkbox')).toBeVisible()
  })
})
