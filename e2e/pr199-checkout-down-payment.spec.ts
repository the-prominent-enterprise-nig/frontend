import { test, expect, type Page, type Locator } from '@playwright/test'
import { gotoReady, loginAs, openCustomSelect, pickCartPriceUse } from './utils'

// PR #199 review (Chloe, 2026-10-02), point 5 at the till: "Calculation are
// currently wrong". The till showed "30% min" and ₱4,614 on her SHARP while
// the monthly came from the rate card — which is worked out from the card's
// own ₱3,380 down. 2026-10-28: the down payment is a field the cashier can
// change (even to 0), so on an in-house installment plan:
//   - the card quotes a down payment AND a monthly for the term → the card's
//     down payment is the starting figure and the monthly is the card's;
//   - change the down payment → the card's monthly no longer fits, so it is
//     recalculated from the term's rate, and the till says so;
//   - the card does not quote the term, or has no down payment at all → the
//     card's figure / a 10% default as a starting point, editable.
//
// Runs as the Bago cashier against the dev servers' data: it needs the
// SHARP 2TC32GH3000X and the DOWELL STF3238 fan in stock at Bago, and the
// cashier's Counter 1 session open (the manual test script's setup). Nothing
// is sold — it only builds a cart and reads the down-payment panel.

const DEV_PASSWORD = 'dev-prominent-enterprise-2026'
const CASHIER_EMAIL = 'technova.b1.cashier@test.com'
const SHARP = '2TC32GH3000X'
const FAN = 'STF3238'

async function openCheckout(page: Page) {
  await gotoReady(page, '/pos/checkout')
  const newSale = page.getByRole('button', { name: 'Start New Sale' })
  if (await newSale.isVisible().catch(() => false)) await newSale.click()
  await expect(page.getByPlaceholder('Search by name or serial')).toBeVisible({ timeout: 20_000 })
}

async function addItem(page: Page, query: string) {
  const search = page.getByPlaceholder('Search by name or serial')
  const card = page.getByRole('button').filter({ hasText: query }).first()
  await expect(async () => {
    await search.fill(query)
    await expect(card).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 20_000 })
  await card.click()

  // A serial-tracked item opens the serial picker straight away; take the
  // first unit in this branch (the panel under test doesn't depend on which).
  const heading = page.getByRole('heading', { name: 'Select Serial Number' })
  if (await heading.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page
      .getByText('In this branch', { exact: true })
      .locator('xpath=following-sibling::*[1]')
      .getByRole('button')
      .first()
      .click()
    await expect(page.getByText('Select Serial Number', { exact: true })).toHaveCount(0, {
      timeout: 10_000,
    })
  }
}

/** The sale's one installment plan card. */
const planPanel = (page: Page) => page.getByTestId('installment-plan')

async function pickTerm(panel: Locator, page: Page, months: string) {
  // Named by what it shows: the placeholder, or the term already picked.
  await openCustomSelect(panel.getByRole('combobox', { name: /Select a term|months/ }))
  await page.getByRole('option', { name: months, exact: true }).click()
}

/** The line's own Price Use — a type-ahead dropdown in the cart row. */
async function setPriceUse(page: Page, index: number, label: string) {
  await pickCartPriceUse(page, label, index)
}

test.describe('PR #199 — down payment at the till', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test.beforeEach(async ({ page }) => {
    await loginAs(page, CASHIER_EMAIL, DEV_PASSWORD)
    await openCheckout(page)
  })

  test("the price list's down payment starts the plan, and its monthly stays while it is untouched", async ({
    page,
  }) => {
    await addItem(page, SHARP)
    await setPriceUse(page, 0, 'WIP')
    await page.getByRole('button', { name: 'Installment', exact: true }).click()

    const panel = planPanel(page)
    await expect(panel).toBeVisible({ timeout: 15_000 })
    await pickTerm(panel, page, '3 months')

    // Was: ₱4,614.00 · "30% min" · Change amount · "Fixed at 30% of the sale amount".
    await expect(panel.getByTestId('down-payment-input')).toHaveValue('3380.00', {
      timeout: 15_000,
    })
    await expect(panel).toContainText('Rate card')
    await expect(panel).not.toContainText('30%')
    await expect(panel.getByTestId('dp-changed-note')).toHaveCount(0)
    // The card's 3-month monthly, from that down payment.
    await expect(panel).toContainText('₱4,845.00', { timeout: 15_000 })

    // The card's down payment is the same for every term it quotes.
    await pickTerm(panel, page, '6 months')
    await expect(panel.getByTestId('down-payment-input')).toHaveValue('3380.00')
    await expect(panel).toContainText('₱2,650.00', { timeout: 15_000 })
  })

  test("changing the down payment away from the card's recalculates the monthly, and says so", async ({
    page,
  }) => {
    await addItem(page, SHARP)
    await setPriceUse(page, 0, 'WIP')
    await page.getByRole('button', { name: 'Installment', exact: true }).click()

    const panel = planPanel(page)
    await expect(panel).toBeVisible({ timeout: 15_000 })
    await pickTerm(panel, page, '3 months')
    await expect(panel).toContainText('₱4,845.00', { timeout: 15_000 })

    const box = panel.getByTestId('down-payment-input')
    await box.fill('5000')
    await box.blur()
    await expect(box).toHaveValue('5000.00')
    await expect(panel.getByTestId('dp-changed-note')).toBeVisible({ timeout: 10_000 })
    await expect(panel).toContainText('Changed')
    // The card's monthly is set aside: the term's own rate prices it now.
    await expect(panel).not.toContainText('₱4,845.00', { timeout: 15_000 })

    // 0 is fine too — a down payment can be nothing.
    await box.fill('0')
    await box.blur()
    await expect(panel.getByTestId('down-payment-error')).toHaveCount(0)

    // Back to the card's own figure: the card's monthly is back.
    await box.fill('3380')
    await box.blur()
    await expect(panel.getByTestId('dp-changed-note')).toHaveCount(0, { timeout: 10_000 })
    await expect(panel).toContainText('₱4,845.00', { timeout: 15_000 })
  })

  test("a term the card does not quote starts from the card's figure, and a typed figure survives a change of term", async ({
    page,
  }) => {
    await addItem(page, SHARP)
    await setPriceUse(page, 0, 'ZI')
    await page.getByRole('button', { name: 'Installment', exact: true }).click()

    const panel = planPanel(page)
    await expect(panel).toBeVisible({ timeout: 15_000 })
    // ZI's card only quotes 12 months.
    await pickTerm(panel, page, '6 months')
    await expect(panel).toContainText('Rate card', { timeout: 15_000 })
    await expect(panel.getByTestId('down-payment-input')).toHaveValue('3510.00')

    // Type a different figure — the down payment is a field from the start.
    const box = panel.getByTestId('down-payment-input')
    await box.fill('5000')
    await box.blur()
    await expect(box).toHaveValue('5000.00')

    // …then move onto the 12-month term, which the card does quote: what was
    // typed stays, and the card's monthly (worked out from ₱3,510) is set aside.
    await pickTerm(panel, page, '12 months')
    await expect(box).toHaveValue('5000.00')
    await expect(panel.getByTestId('dp-changed-note')).toBeVisible({ timeout: 15_000 })
  })

  test('an item with no price-list down payment starts at 10%, and the field is editable', async ({
    page,
  }) => {
    await addItem(page, FAN)
    await setPriceUse(page, 0, 'WIP')
    await page.getByRole('button', { name: 'Installment', exact: true }).click()

    const panel = planPanel(page)
    await expect(panel).toBeVisible({ timeout: 15_000 })
    await pickTerm(panel, page, '3 months')
    await expect(panel).toContainText('10% default', { timeout: 15_000 })
    await expect(panel.getByTestId('down-payment-input')).toBeVisible()
    await expect(panel).not.toContainText('Rate card')
  })
})
