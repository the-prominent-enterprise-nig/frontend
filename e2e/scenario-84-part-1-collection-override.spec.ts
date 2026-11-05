import { test, expect, type Page } from '@playwright/test'
import { fillStable, gotoReady } from './utils'

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
// Read-only: nothing is collected, so any customer with an open due will do.

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

  test.beforeAll(async ({ request }) => {
    const res = await request.get('/api/pos/customers/collections')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    const rows: { name: string; outstandingCount?: number }[] = Array.isArray(body)
      ? body
      : (body.data ?? [])
    const withDue = rows.find((r) => (r.outstandingCount ?? 0) > 0)
    test.skip(!withDue, 'No customer with an open due on this database')
    customerName = withDue!.name
  })

  async function tickFirstDue(page: Page) {
    await gotoReady(page, '/pos/collections')
    await fillStable(page.getByPlaceholder('Filter by name or phone…'), customerName)
    const row = page.locator('ul > li > button').filter({ hasText: customerName }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.click()
    const due = page
      .locator('li')
      .filter({ has: page.getByRole('checkbox') })
      .first()
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
    // Option 1 (2026-11-05). Which branch applies depends on whether this
    // database has an open session the screen can attach the collection to.
    await tickFirstDue(page)
    await fillStable(overrideInput(page), localDay(-1))
    const assessedLabel = page.getByText('Rebate / penalty as of')
    if (await assessedLabel.isVisible()) {
      await expect(page.getByTestId('collection-assessed-as-of')).toBeVisible()
      await expect(page.getByTestId('collection-assessed-as-of')).toContainText('dated today')
    } else {
      // No session to count it: the picked day is the receipt's own date.
      await expect(page.getByText('Payment date', { exact: false })).toBeVisible()
      await expect(page.getByTestId('collection-assessed-as-of')).toHaveCount(0)
    }
  })
})
