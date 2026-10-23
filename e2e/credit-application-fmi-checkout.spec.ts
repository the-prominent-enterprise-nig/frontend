import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'
import {
  addInstallmentLine,
  approvedApplication,
  pickCustomer,
} from './credit-application-checkout'

// The FMI date on a credit application starts the schedule of the sale that
// uses it (backend: pos-credit-application-fmi.e2e-spec.ts). The till says so
// before Confirm: which date the first installment falls due, or that the
// application's date will not be used — it has passed by sale day, or sits more
// than a year out — and the first installment falls due a month after the sale.

/** A calendar date `days` from today, as an application would record it. */
const dateIn = (days: number) => {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** The date the way the till prints it, worked out by the browser itself. */
const labelFor = (page: Page, iso: string) =>
  page.evaluate(
    (value) =>
      new Date(`${value}T12:00:00`).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    iso
  )

test.describe('Credit application — the FMI date at the till', () => {
  test.describe.configure({ timeout: 150_000 })

  async function openWithApplication(page: Page, firstDueDate?: string) {
    const app = await approvedApplication(page, { percent: 0.1, firstDueDate })
    await gotoReady(page, '/pos/checkout')
    await addInstallmentLine(page)
    await pickCustomer(page, app.name)
    await expect(
      page.getByRole('combobox', { name: new RegExp(app.applicationNumber) })
    ).toBeVisible({ timeout: 30_000 })
    return app
  }

  test('FC-F01: a usable FMI date is shown as the first installment’s due date', async ({
    page,
  }) => {
    const fmi = dateIn(45)
    await openWithApplication(page, fmi)

    const note = page.getByTestId('application-fmi-note')
    await expect(note).toBeVisible({ timeout: 15_000 })
    await expect(note).toContainText('First installment due')
    await expect(note).toContainText(await labelFor(page, fmi))
    await expect(note).toContainText('type the terms yourself')
  })

  test('FC-F02: an FMI date that has already passed is flagged — a month after the sale instead', async ({
    page,
  }) => {
    const fmi = dateIn(-10)
    await openWithApplication(page, fmi)

    const note = page.getByTestId('application-fmi-note')
    await expect(note).toBeVisible({ timeout: 15_000 })
    await expect(note).toContainText('has passed')
    await expect(note).toContainText(await labelFor(page, fmi))
    await expect(note).toContainText('one month after this sale')
  })

  test('FC-F03: an FMI date more than a year out is flagged too', async ({ page }) => {
    await openWithApplication(page, dateIn(500))

    const note = page.getByTestId('application-fmi-note')
    await expect(note).toBeVisible({ timeout: 15_000 })
    await expect(note).toContainText('more than a year away')
    await expect(note).toContainText('one month after this sale')
  })

  test('FC-F04: an application with no FMI date says nothing about one', async ({ page }) => {
    await openWithApplication(page, undefined)
    // The application is picked and the panel is up; there is just no note.
    await expect(page.getByTestId('application-fmi-note')).toHaveCount(0)
  })
})
