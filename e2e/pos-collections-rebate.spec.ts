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

// Collections rebate (Prompt Payment Discount). An on-time due's rebate is a
// checkbox in the panel's per-due table, ticked by default at the plan's ppd;
// Net is the due less the rebate, so collecting Net with the rebate ticked
// settles the due exactly. Unticking it puts Net back to the full due. (The
// rebate used to be a typed amount with its own cap; it is no longer typed.)
//
// The plan is built through checkout (collections-plan.ts): the seed has no
// open dues, and a bare API sale now needs an approved credit application.

const PREFIX = 'E2E Rebate Collections'

const previewRow = (page: Page) => page.locator('table tbody tr').first()
const rebateCell = (page: Page) => previewRow(page).locator('td').nth(3)
const netCell = (page: Page) => previewRow(page).locator('td').nth(5)

test.describe('POS Collections — rebate', () => {
  let fx: PlanFixtures | undefined

  test.beforeAll(async ({ playwright }, testInfo) => {
    const request = await playwright.request.newContext({
      baseURL: testInfo.project.use.baseURL,
      storageState: OWNER_STATE,
    })
    fx = await createPlanFixtures(request, PREFIX)
    await request.dispose()
  })

  test.afterAll(async ({ playwright }, testInfo) => {
    const request = await playwright.request.newContext({
      baseURL: testInfo.project.use.baseURL,
      storageState: OWNER_STATE,
    })
    await deletePlanFixtures(request, fx)
    await request.dispose()
  })

  test('an on-time due has its rebate ticked at ppd, Net is the due less it, and collecting Net settles the due', async ({
    page,
  }) => {
    test.setTimeout(150_000)
    const customer = await createInstallmentPlan(page, fx!, 'R1')

    // Real ppd for this account, straight from the API, so the table is
    // checked against the exact figure, not just "some positive number".
    const schedules = (await (
      await page.request.get(`/api/pos/customers/${customer.id}/installment-schedules`)
    ).json()) as { installmentAccount: { ppd: number } | null }[] | { data: unknown[] }
    const list = (Array.isArray(schedules) ? schedules : schedules.data) as {
      installmentAccount: { ppd: number } | null
    }[]
    const ppd = Number(list[0].installmentAccount!.ppd)
    expect(ppd).toBeGreaterThan(0)

    await openCustomerOnCollections(page, customer.name)
    await tickDue(page, 1)

    const due = pesos(await previewRow(page).locator('td').nth(2).innerText())
    const rebateBox = rebateCell(page).getByRole('checkbox')
    await expect(rebateBox).toBeChecked()
    expect(pesos(await rebateCell(page).innerText())).toBe(ppd)
    const net = Math.round((due - ppd) * 100) / 100
    expect(pesos(await netCell(page).innerText())).toBe(net)

    // Unticked, the rebate is not applied: Net is the whole due.
    await rebateBox.uncheck()
    await expect.poll(async () => pesos(await netCell(page).innerText())).toBe(due)
    await rebateBox.check()
    await expect.poll(async () => pesos(await netCell(page).innerText())).toBe(net)

    await fillMoney(page.getByTestId('collection-amount-0'), net)
    await page.getByRole('button', { name: 'Collect payment' }).click()
    await expect(page.getByRole('heading', { name: 'Collect Payment' })).not.toBeVisible({
      timeout: 20_000,
    })
    await expect(dueRow(page, 1).getByTitle(/already fully paid/)).toBeVisible({
      timeout: 15_000,
    })
  })
})
