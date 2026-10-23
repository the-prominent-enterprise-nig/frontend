import { test, expect } from '@playwright/test'
import { gotoReady, fillStable, openCustomSelect } from './utils'
import {
  addInstallmentLine,
  approvedApplication,
  pickCustomer,
} from './credit-application-checkout'

// Client list 2026-10-15, "natural installment": no restriction for a low down
// payment — it can be below the required figure, but never 0. Checkout already
// worked that way; the credit application now does too, and the till takes the
// approved figure as approved instead of raising it back to 10%.

test.describe('Credit application — a low down payment', () => {
  test.describe.configure({ timeout: 150_000 })

  test('LD-F01: the till takes an approved application’s low down payment as approved, not raised to 10%', async ({
    page,
  }) => {
    const app = await approvedApplication(page, { percent: 0.02 })
    // 2% of the item total — well under the old 10% minimum.
    expect(app.downPayment).toBeLessThan(app.total * 0.1)

    await gotoReady(page, '/pos/checkout')
    await addInstallmentLine(page)
    await pickCustomer(page, app.name)

    // The matching application is picked for the cashier, with its term.
    await expect(
      page.getByRole('combobox', { name: new RegExp(app.applicationNumber) })
    ).toBeVisible({ timeout: 30_000 })

    const dp = page.getByTestId('down-payment-input')
    await expect(dp).toHaveValue(app.downPayment.toFixed(2), { timeout: 15_000 })
    await expect(page.getByTestId('down-payment-error')).toHaveCount(0)
  })

  test('LD-F02: a term picked first seeds 10%, and the application’s smaller figure still replaces it', async ({
    page,
  }) => {
    const app = await approvedApplication(page, { percent: 0.02 })

    await gotoReady(page, '/pos/checkout')
    await addInstallmentLine(page)

    // Pick a term before the customer: this pre-fills the 10% starting value.
    const termSelect = page.getByRole('combobox', { name: 'Select a term…' })
    await expect(termSelect).toBeVisible({ timeout: 10_000 })
    await openCustomSelect(termSelect)
    await page
      .getByRole('option', { name: new RegExp(`^${app.termMonths} months`) })
      .first()
      .click()
    const dp = page.getByTestId('down-payment-input')
    await expect(async () => {
      const seeded = Number(await dp.inputValue())
      expect(seeded).toBeGreaterThan(app.downPayment)
    }).toPass({ timeout: 15_000 })

    await pickCustomer(page, app.name)
    await expect(
      page.getByRole('combobox', { name: new RegExp(app.applicationNumber) })
    ).toBeVisible({ timeout: 30_000 })
    await expect(dp).toHaveValue(app.downPayment.toFixed(2), { timeout: 15_000 })
  })

  test('LD-F03: a down payment the cashier typed is still never reduced to the approved figure', async ({
    page,
  }) => {
    const app = await approvedApplication(page, { percent: 0.02 })

    await gotoReady(page, '/pos/checkout')
    await addInstallmentLine(page)

    const termSelect = page.getByRole('combobox', { name: 'Select a term…' })
    await expect(termSelect).toBeVisible({ timeout: 10_000 })
    await openCustomSelect(termSelect)
    await page
      .getByRole('option', { name: new RegExp(`^${app.termMonths} months`) })
      .first()
      .click()

    // The counter agreed a larger figure than the application's.
    const typedAmount = Math.ceil(app.total * 0.3)
    const dp = page.getByTestId('down-payment-input')
    await fillStable(dp, String(typedAmount))

    await pickCustomer(page, app.name)
    await expect(
      page.getByRole('combobox', { name: new RegExp(app.applicationNumber) })
    ).toBeVisible({ timeout: 30_000 })
    await expect(dp).toHaveValue(typedAmount.toFixed(2), { timeout: 15_000 })
  })
})
