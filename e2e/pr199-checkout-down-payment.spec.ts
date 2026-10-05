import { test, expect, type Page, type Locator } from '@playwright/test'
import { gotoReady, loginAs, openCustomSelect } from './utils'

// PR #199 review (Chloe, 2026-10-02), point 5 at the till: "Calculation are
// currently wrong". The till showed "30% min" and ₱4,614 on her SHARP while
// the monthly came from the rate card — which is worked out from the card's
// own ₱3,380 down. Now, on an in-house installment line:
//   - the card quotes a down payment AND a monthly for the term → that down
//     payment, locked ("Rate card", no "Change amount");
//   - the card does not quote the term → the card's figure as a starting
//     point, editable, minimum 10%;
//   - no card down payment at all → development's "10% min".
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

/** The per-line installment panel for the line whose name contains `query`
 * — the line's own box in the payment section, found by its item name, which
 * it shows whether or not the down-payment editor is open. */
const linePanel = (page: Page, query: string) =>
  page
    .locator('div.rounded-lg.border-purple-100', { hasText: query })
    .filter({ has: page.getByRole('button', { name: 'Inhouse Installment' }) })
    .last()

async function pickTerm(panel: Locator, page: Page, months: string) {
  // Named by what it shows: the placeholder, or the term already picked.
  await openCustomSelect(panel.getByRole('combobox', { name: /Select a term|months/ }))
  await page.getByRole('option', { name: months, exact: true }).click()
}

/** The line's own Price Use — a native select in the cart row. */
async function setPriceUse(page: Page, index: number, label: string) {
  await page.getByLabel('Price Use').nth(index).selectOption({ label })
}

test.describe('PR #199 — down payment at the till', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test.beforeEach(async ({ page }) => {
    await loginAs(page, CASHIER_EMAIL, DEV_PASSWORD)
    await openCheckout(page)
  })

  test("the price list's down payment is locked for a term it quotes", async ({ page }) => {
    await addItem(page, SHARP)
    await setPriceUse(page, 0, 'WIP')
    await page.getByRole('button', { name: 'Installment', exact: true }).click()

    const panel = linePanel(page, SHARP)
    await expect(panel).toBeVisible({ timeout: 15_000 })
    await pickTerm(panel, page, '3 months')

    // Was: ₱4,614.00 · "30% min" · Change amount · "Fixed at 30% of the sale amount".
    await expect(panel).toContainText('₱3,380.00', { timeout: 15_000 })
    await expect(panel).toContainText('Rate card')
    await expect(panel).toContainText('Set by the rate card for this term')
    await expect(panel.getByRole('button', { name: 'Change amount' })).toHaveCount(0)
    await expect(panel).not.toContainText('30%')
    // The card's 3-month monthly, from that down payment.
    await expect(panel).toContainText('₱4,845.00', { timeout: 15_000 })

    // The card's down payment is the same for every term it quotes.
    await pickTerm(panel, page, '6 months')
    await expect(panel).toContainText('₱3,380.00', { timeout: 15_000 })
    await expect(panel).toContainText('₱2,650.00', { timeout: 15_000 })
    await expect(panel.getByRole('button', { name: 'Change amount' })).toHaveCount(0)
  })

  test('a term the card does not quote is editable from the 10% minimum; moving onto a card term locks it again', async ({
    page,
  }) => {
    await addItem(page, SHARP)
    await setPriceUse(page, 0, 'ZI')
    await page.getByRole('button', { name: 'Installment', exact: true }).click()

    const panel = linePanel(page, SHARP)
    await expect(panel).toBeVisible({ timeout: 15_000 })
    // ZI's card only quotes 12 months.
    await pickTerm(panel, page, '6 months')
    await expect(panel).toContainText('From the rate card — the minimum accepted is 10%', {
      timeout: 15_000,
    })
    await expect(panel).toContainText('₱3,510.00')

    // Type a different figure…
    await panel.getByRole('button', { name: 'Change amount' }).click()
    // The editor replaces the panel's "Down payment" heading, so it is found
    // on the page — this cart has the one line.
    const box = page.getByPlaceholder('Down payment')
    await box.fill('5000')
    await box.blur()
    await expect(page.getByText('₱5,000.00').first()).toBeVisible({ timeout: 10_000 })

    // …then move onto the 12-month term, which the card does quote: the
    // card's figure replaces it and the field locks.
    await pickTerm(panel, page, '12 months')
    await expect(panel).toContainText('₱3,510.00', { timeout: 15_000 })
    await expect(panel).toContainText('Set by the rate card for this term')
    await expect(panel.getByRole('button', { name: 'Change amount' })).toHaveCount(0)
    await expect(panel).toContainText('₱1,340.00', { timeout: 15_000 })
  })

  test('an item with no price-list down payment keeps the 10% minimum', async ({ page }) => {
    await addItem(page, FAN)
    await setPriceUse(page, 0, 'WIP')
    await page.getByRole('button', { name: 'Installment', exact: true }).click()

    const panel = linePanel(page, FAN)
    await expect(panel).toBeVisible({ timeout: 15_000 })
    await pickTerm(panel, page, '3 months')
    await expect(panel).toContainText('10% min', { timeout: 15_000 })
    await expect(panel).toContainText('Fixed at 10% of the sale amount')
    await expect(panel.getByRole('button', { name: 'Change amount' })).toBeVisible()
    await expect(panel).not.toContainText('Rate card')
  })
})
