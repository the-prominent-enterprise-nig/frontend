import { test, expect, type Page } from '@playwright/test'
import { clickStable, fillStable, gotoReady } from './utils'

// Scenario 29 follow-up — the standalone /crm/reminders page split into
// "Overdue"/"Upcoming" sections using the same broken `isOverdue ||
// status === 'overdue'` filter the CRM dashboard had (fixed in
// crm-dashboard-overdue-reminders.spec.ts). Its "Overdue" section was
// therefore always empty — every past-due, still-pending reminder rendered
// under "Upcoming" instead. This proves the fix on this specific page.

const CUSTOMER_NAME_PREFIX = 'E2E RemindersPageFixture'

async function submitStable(
  fill: () => Promise<void>,
  submit: () => Promise<void>,
  verify: () => Promise<void>
): Promise<void> {
  await expect(async () => {
    await fill()
    await submit()
    await verify()
  }).toPass({ timeout: 30_000 })
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

test.describe('CRM Reminders Page — Overdue Section', () => {
  let createdCustomerId: string | undefined

  test.afterEach(async ({ request }) => {
    if (createdCustomerId) {
      await request.delete(`/api/crm/customers/${createdCustomerId}`).catch(() => {})
      createdCustomerId = undefined
    }
  })

  test('a past-due, still-pending reminder shows in the Overdue section, not Upcoming', async ({
    page,
  }: {
    page: Page
  }) => {
    const suffix = Date.now()
    const customerName = `${CUSTOMER_NAME_PREFIX} ${suffix}`
    const customerRes = await page.request.post('/api/crm/customers', {
      data: { name: customerName, phone: `0917${suffix.toString().slice(-7)}` },
    })
    expect(customerRes.ok()).toBeTruthy()
    createdCustomerId = (await customerRes.json()).id as string

    await gotoReady(page, `/crm/customers/${createdCustomerId}`)
    await clickStable(
      page.getByRole('button', { name: 'Schedule reminder' }),
      page.getByRole('heading', { name: 'Schedule reminder' })
    )
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(9, 0, 0, 0)
    const overdueNote = `E2E reminders-page overdue check ${suffix}`
    await submitStable(
      async () => {
        await fillStable(page.locator('#reminder-due-at'), toDatetimeLocal(yesterday))
        await fillStable(page.locator('#reminder-note'), overdueNote)
      },
      () => page.locator('form').getByRole('button', { name: 'Schedule', exact: true }).click(),
      () =>
        expect(page.getByRole('heading', { name: 'Schedule reminder' })).toHaveCount(0, {
          timeout: 8_000,
        })
    )

    await gotoReady(page, '/crm/reminders')

    const card = page
      .getByText(overdueNote, { exact: true })
      .locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]')
    await expect(card).toBeVisible({ timeout: 15_000 })
    // The bug: this card would render with the orange "Upcoming" accent and
    // no "Overdue" badge at all if isOverdue were still computed from the
    // (always-false) API field instead of a live date comparison.
    await expect(card.getByText('Overdue', { exact: true })).toBeVisible()

    const overdueSection = page
      .getByRole('heading', { name: 'Overdue', exact: true })
      .locator('xpath=ancestor::div[1]/following-sibling::div[1]')
    await expect(overdueSection.getByText(overdueNote)).toBeVisible()
  })
})
