import { test, expect, type Page } from '@playwright/test'
import { gotoReady, fillStable, openCustomSelect } from './utils'
import { addInstallmentLine, addItemToCart, ensureBagoSession } from './credit-application-checkout'

// Client notes 2026-10-28: an installment sale is ONE plan — one provider, one
// term, one down payment, one ledger — however many items are in the cart. The
// till asks for each of them once.
//
// Needs a till session at Bago and these items stocked there: DOWELL STF3238
// (added by addInstallmentLine) and AULA F606HWL — on the WIP list with no
// rate card, so their down payment and terms are open; ASTRON LED3277 — the
// card quotes 3 months with a down payment of ₱2,320.

const ASTRON = 'LED3277'
const AULA = 'F606HWL'

const plan = (page: Page) => page.getByTestId('installment-plan')
const dpField = (page: Page) => page.getByTestId('combined-down-payment')
const dpInput = (page: Page) => page.getByTestId('down-payment-input')
const dpError = (page: Page) => page.getByTestId('down-payment-error')
const termPicker = (page: Page) =>
  plan(page).getByRole('combobox', { name: /Select a term|months/ })

/** Picks the plan's one term. */
async function pickTerm(page: Page, months: number) {
  await expect(termPicker(page)).toBeVisible({ timeout: 15_000 })
  await openCustomSelect(termPicker(page))
  await page
    .getByRole('option', { name: new RegExp(`^${months} months`) })
    .first()
    .click()
}

/** The fan, then `second`, both in the cart as installment. */
async function twoItems(page: Page, second: string) {
  await gotoReady(page, '/pos/checkout')
  await addInstallmentLine(page)
  await addItemToCart(page, second, 1)
  await expect(page.getByTestId('installment-plan')).toHaveCount(1, { timeout: 15_000 })
}

test.describe('POS checkout — one installment plan for the whole cart', () => {
  test.describe.configure({ timeout: 150_000 })

  test.beforeEach(async ({ page }) => {
    await ensureBagoSession(page)
  })

  test('PLAN-01: two items share ONE provider toggle, ONE term and ONE down payment box', async ({
    page,
  }) => {
    await twoItems(page, AULA)

    await expect(page.getByRole('button', { name: 'Inhouse Installment' })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'TPF Installment' })).toHaveCount(1)
    await expect(page.getByRole('combobox', { name: 'Select a term…' })).toHaveCount(1)
    await expect(dpInput(page)).toHaveCount(1)
    await expect(dpField(page)).toContainText('One down payment for these 2 items')
  })

  test('PLAN-02: the term applies to every item, and a down payment typed once is the sale’s', async ({
    page,
  }) => {
    await twoItems(page, AULA)
    await pickTerm(page, 12)

    // Still one picker, now showing the term — no second item left waiting for one.
    await expect(page.getByRole('combobox', { name: 'Select a term…' })).toHaveCount(0)
    await expect(termPicker(page)).toContainText('12 months')

    await fillStable(dpInput(page), '1000')
    await dpInput(page).blur()
    await expect(dpInput(page)).toHaveValue('1000.00')
    await expect(page.getByTestId('dp-payment-mode-toggle')).toContainText('₱1,000.00')
  })

  test('PLAN-03: an in-house down payment can be 0, and never more than the items cost', async ({
    page,
  }) => {
    await twoItems(page, AULA)
    await pickTerm(page, 12)

    await fillStable(dpInput(page), '0')
    await expect(dpError(page)).toHaveCount(0)
    // Nothing is paid at the register, so there is nothing to tender.
    await expect(page.getByText('Nothing to collect for the items at checkout')).toBeVisible()
    await expect(page.getByTestId('dp-payment-mode-toggle')).toHaveCount(0)

    await fillStable(dpInput(page), '99999999')
    await expect(dpError(page)).toContainText('these items cost')

    await fillStable(dpInput(page), '5')
    await expect(dpError(page)).toHaveCount(0)
  })

  test('PLAN-04: a third item added later joins the plan already chosen', async ({ page }) => {
    await twoItems(page, AULA)
    await pickTerm(page, 6)
    await addItemToCart(page, ASTRON, 2)

    await expect(plan(page)).toHaveCount(1)
    await expect(page.getByRole('combobox', { name: 'Select a term…' })).toHaveCount(0)
    await expect(termPicker(page)).toContainText('6 months')
    await expect(dpField(page)).toContainText('One down payment for these 3 items')
  })

  test('PLAN-05: a rate-card item adds its own down payment to the starting figure; changing it shows as Changed', async ({
    page,
  }) => {
    await twoItems(page, ASTRON)
    await pickTerm(page, 3)

    // The ASTRON's ₱2,320 is part of the plan's starting down payment.
    await expect
      .poll(async () => Number(await dpInput(page).inputValue()), { timeout: 15_000 })
      .toBeGreaterThan(2320)
    await expect(dpField(page)).toContainText(/Rate card/)

    await fillStable(dpInput(page), '3000')
    await dpInput(page).blur()
    await expect(dpInput(page)).toHaveValue('3000.00')
    await expect(dpField(page)).toContainText('Changed')
  })

  test('PLAN-06: a TPF plan has one down payment too — and it is never 0', async ({ page }) => {
    await twoItems(page, AULA)
    await page.getByRole('button', { name: 'TPF Installment' }).click()

    await expect(dpField(page)).toHaveCount(1, { timeout: 15_000 })
    await expect(dpInput(page)).toHaveCount(1)
    await expect(page.getByRole('combobox', { name: /Select a term/ })).toHaveCount(0)

    await fillStable(dpInput(page), '0')
    await expect(dpError(page)).toContainText('not 0')

    await fillStable(dpInput(page), '600')
    await dpInput(page).blur()
    await expect(dpInput(page)).toHaveValue('600.00')
    await expect(dpError(page)).toHaveCount(0)
  })
})
