import { test, expect, type Page, type Locator } from '@playwright/test'
import { clickStable, deleteCustomers, fillStable, gotoReady, sweepE2ECustomers } from './utils'

const CUSTOMER_NAME_PREFIX = 'E2E OverdueReminderFixture'

// Scenario 29 (CRM section) — the dashboard's overdue-reminder filter relied
// on `isOverdue`/`status === 'overdue'`, neither of which the /crm/reminders
// endpoint this page calls ever populates, so a truly overdue reminder
// silently sorted into "Upcoming" instead of "Overdue." Fix mirrors
// Accounting's own live date-comparison pattern (accounting/page.tsx) —
// this test proves a past-due, still-pending reminder lands in the right
// bucket on the dashboard, not the old one.

/** Same hydration-race retry fillStable uses, for a whole fill+submit sequence. */
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

async function scheduleReminder(
  page: Page,
  customerId: string,
  dueAtLocal: string,
  note: string
): Promise<void> {
  await gotoReady(page, `/crm/customers/${customerId}`)
  await clickStable(
    page.getByRole('button', { name: 'Schedule reminder' }),
    page.getByRole('heading', { name: 'Schedule reminder' })
  )
  await submitStable(
    async () => {
      await fillStable(page.locator('#reminder-due-at'), dueAtLocal)
      await fillStable(page.locator('#reminder-note'), note)
    },
    () => page.locator('form').getByRole('button', { name: 'Schedule', exact: true }).click(),
    () =>
      expect(page.getByRole('heading', { name: 'Schedule reminder' })).toHaveCount(0, {
        timeout: 8_000,
      })
  )
}

// `div[contains(@class,"rounded-xl")][1]` on the reverse `ancestor::` axis
// resolves to the NEAREST matching ancestor (XPath reverse axes are ordered
// closest-first) — the panel's own container, not the inner header row
// (which lacks that class) or some much higher-level page wrapper that
// would also happen to contain the heading and break the overdue/upcoming
// scoping this test relies on.
function panelByHeading(page: Page, heading: string): Locator {
  return page
    .getByRole('heading', { name: heading })
    .locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]')
}

test.describe('CRM Dashboard — Overdue Reminders', () => {
  let createdCustomerIds: string[] = []

  test.beforeAll(async ({ request }) => {
    await sweepE2ECustomers(request, CUSTOMER_NAME_PREFIX)
  })

  test.afterEach(async ({ request }) => {
    for (const customerId of createdCustomerIds) {
      const remindersRes = await request.get(`/api/crm/reminders?customerId=${customerId}`)
      if (remindersRes.ok()) {
        const body = await remindersRes.json()
        const reminders = (body.data ?? body ?? []) as { id: string }[]
        for (const r of reminders) {
          await request.delete(`/api/crm/reminders/${r.id}`).catch(() => {})
        }
      }
    }
    await deleteCustomers(request, createdCustomerIds)
    createdCustomerIds = []
  })

  test('a past-due, still-pending reminder shows as Overdue, not Upcoming', async ({ page }) => {
    const suffix = Date.now()
    const customerName = `${CUSTOMER_NAME_PREFIX} ${suffix}`
    const customerRes = await page.request.post('/api/crm/customers', {
      data: { name: customerName, phone: `0917${suffix.toString().slice(-7)}` },
    })
    expect(customerRes.ok()).toBeTruthy()
    const customerId = (await customerRes.json()).id as string
    createdCustomerIds.push(customerId)

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(9, 0, 0, 0)
    const overdueNote = `E2E overdue check ${suffix}`

    await scheduleReminder(page, customerId, toDatetimeLocal(yesterday), overdueNote)

    await gotoReady(page, '/crm')
    const overduePanel = panelByHeading(page, 'Overdue Reminders')
    const upcomingPanel = panelByHeading(page, 'Upcoming Reminders')

    await expect(overduePanel.getByText(overdueNote)).toBeVisible({ timeout: 15_000 })
    await expect(upcomingPanel.getByText(overdueNote)).toHaveCount(0)

    // "Who" the reminder is for — a link back to the fixture customer,
    // resolved from the relation the backend already includes
    // (reminder.service.ts findAll()) but the dashboard wasn't rendering.
    const targetLink = overduePanel.getByRole('link', { name: customerName })
    await expect(targetLink).toBeVisible()
    await expect(targetLink).toHaveAttribute('href', `/crm/customers/${customerId}`)
  })

  test('a future, still-pending reminder shows as Upcoming, not Overdue', async ({ page }) => {
    const suffix = Date.now()
    const customerName = `${CUSTOMER_NAME_PREFIX} ${suffix}`
    const customerRes = await page.request.post('/api/crm/customers', {
      data: { name: customerName, phone: `0917${suffix.toString().slice(-7)}` },
    })
    expect(customerRes.ok()).toBeTruthy()
    const customerId = (await customerRes.json()).id as string
    createdCustomerIds.push(customerId)

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    const upcomingNote = `E2E upcoming check ${suffix}`

    await scheduleReminder(page, customerId, toDatetimeLocal(tomorrow), upcomingNote)

    await gotoReady(page, '/crm')
    const overduePanel = panelByHeading(page, 'Overdue Reminders')
    const upcomingPanel = panelByHeading(page, 'Upcoming Reminders')

    await expect(upcomingPanel.getByText(upcomingNote)).toBeVisible({ timeout: 15_000 })
    await expect(overduePanel.getByText(upcomingNote)).toHaveCount(0)

    const targetLink = upcomingPanel.getByRole('link', { name: customerName })
    await expect(targetLink).toBeVisible()
    await expect(targetLink).toHaveAttribute('href', `/crm/customers/${customerId}`)
  })
})
