import { test, expect } from '@playwright/test'
import { gotoReady, fillStable, openCustomSelect } from './utils'
import {
  addInstallmentLine,
  addItemToCart,
  approvedApplication,
  pickCustomer,
} from './credit-application-checkout'

// Client list 2026-10-15, "natural installment": no restriction for a low down
// payment — it can be below the required figure, but never 0. Checkout already
// worked that way; the credit application now does too, and the till takes the
// approved figure as approved instead of raising it back to 10%.
//
// 2026-10-28: the application is the DEFAULT, not a rule. What the cashier
// changes at the till (the term or the down payment, higher or lower) is what
// stands; the application only fills in what has not been touched.

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

  test('LD-F04: a down payment the cashier typed BELOW the approved figure stands too', async ({
    page,
  }) => {
    // A bigger application figure, so there is room to go under it.
    const app = await approvedApplication(page, { percent: 0.3 })

    await gotoReady(page, '/pos/checkout')
    await addInstallmentLine(page)

    const termSelect = page.getByRole('combobox', { name: 'Select a term…' })
    await expect(termSelect).toBeVisible({ timeout: 10_000 })
    await openCustomSelect(termSelect)
    await page
      .getByRole('option', { name: new RegExp(`^${app.termMonths} months`) })
      .first()
      .click()

    const typedAmount = Math.max(1, Math.floor(app.downPayment / 2))
    expect(typedAmount).toBeLessThan(app.downPayment)
    const dp = page.getByTestId('down-payment-input')
    await fillStable(dp, String(typedAmount))

    await pickCustomer(page, app.name)
    await expect(
      page.getByRole('combobox', { name: new RegExp(app.applicationNumber) })
    ).toBeVisible({ timeout: 30_000 })
    // Give the application every chance to land, then see what is in the box.
    await page.waitForTimeout(1500)
    await expect(dp).toHaveValue(typedAmount.toFixed(2))
  })

  test('LD-F05: a term the cashier changed after the application filled it in is not put back', async ({
    page,
  }) => {
    const app = await approvedApplication(page, { percent: 0.1 })
    const otherMonths = app.termMonths === 12 ? 6 : 12

    await gotoReady(page, '/pos/checkout')
    await addInstallmentLine(page)
    await pickCustomer(page, app.name)
    await expect(
      page.getByRole('combobox', { name: new RegExp(app.applicationNumber) })
    ).toBeVisible({ timeout: 30_000 })

    // The application's term is the default…
    const planTerm = page.getByTestId('installment-plan').getByRole('combobox').first()
    await expect(planTerm).toContainText(`${app.termMonths} months`, { timeout: 15_000 })

    // …until the cashier picks another.
    await openCustomSelect(planTerm)
    await page
      .getByRole('option', { name: new RegExp(`^${otherMonths} months`) })
      .first()
      .click()
    await expect(planTerm).toContainText(`${otherMonths} months`)

    // An item added afterwards makes the till look at the application again;
    // the cashier's term is still the one on the plan.
    await addItemToCart(page, 'F606HWL', 1)
    await expect(page.getByTestId('installment-plan')).toHaveCount(1, { timeout: 15_000 })
    await page.waitForTimeout(2000)
    await expect(planTerm).toContainText(`${otherMonths} months`)
  })
})
