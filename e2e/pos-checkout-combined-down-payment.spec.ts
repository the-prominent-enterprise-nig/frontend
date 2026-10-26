import { test, expect, type Page } from '@playwright/test'
import { gotoReady, fillStable, openCustomSelect } from './utils'
import { addInstallmentLine, addItemToCart, ensureBagoSession } from './credit-application-checkout'

// Client list 2026-10-15: several items on installment pay ONE down payment and
// sit on ONE ledger. The server already groups them that way (in-house lines on
// the same term are one schedule; every TPF line is one down payment); the till
// now asks for the down payment that way too — one box for the group, shared out
// across its items by price.
//
// Needs a till session at Bago and these items stocked there: DOWELL STF3238
// and AULA F606HWL — on the WIP list with no rate card, so their down payment
// and terms are open; ASTRON LED3277 — the card quotes 3 months with a down
// payment of ₱2,320, fixed.

const ASTRON = 'LED3277'
const AULA = 'F606HWL'

const combined = (page: Page) => page.getByTestId('combined-down-payment')
const combinedInput = (page: Page) => combined(page).getByTestId('down-payment-input')
const share = (page: Page) => page.getByTestId('down-payment-share')
const shareAmount = async (page: Page) =>
  Number(
    ((await share(page).first().innerText()).match(/₱\s?([\d,]+\.\d{2})/) ?? [])[1]?.replace(
      /,/g,
      ''
    )
  )

/** Picks the term on the first cart row that has not got one yet. */
async function pickTerm(page: Page, months: number) {
  const select = page.getByRole('combobox', { name: 'Select a term…' }).first()
  await expect(select).toBeVisible({ timeout: 15_000 })
  await openCustomSelect(select)
  await page
    .getByRole('option', { name: new RegExp(`^${months} months`) })
    .first()
    .click()
}

async function twoRows(page: Page, second: string, months: number) {
  await gotoReady(page, '/pos/checkout')
  await addInstallmentLine(page)
  await addItemToCart(page, second, 1)
  await expect(page.getByRole('button', { name: 'Inhouse Installment' })).toHaveCount(2, {
    timeout: 15_000,
  })
  await pickTerm(page, months)
  await pickTerm(page, months)
}

test.describe('POS checkout — one down payment for several installment items', () => {
  test.describe.configure({ timeout: 150_000 })

  test.beforeEach(async ({ page }) => {
    await ensureBagoSession(page)
  })

  test('CD-F01: two open items on the same term share ONE down payment box, split by price', async ({
    page,
  }) => {
    await twoRows(page, AULA, 12)

    // One box for the pair; the second row shows its share, not a field.
    await expect(combined(page)).toHaveCount(1)
    await expect(combinedInput(page)).toBeVisible({ timeout: 15_000 })
    await expect(share(page)).toHaveCount(1)
    await expect(page.getByTestId('down-payment-input')).toHaveCount(1)
    await expect(combined(page)).toContainText('One down payment for these 2 items on 12 months')

    await fillStable(combinedInput(page), '1000')
    await combinedInput(page).blur()
    await expect(combinedInput(page)).toHaveValue('1000.00')
    // And it is what the sale charges: the panel totals the lines' down
    // payments, which are the figures the sale is posted with.
    await expect(page.getByText(/2 items on inhouse installment/)).toContainText(
      'Down payment ₱1,000.00'
    )
    // The headset is ~43% of the pair's price (₱800 against the fan's ₱1,050),
    // so it carries ~43% of it.
    await expect.poll(() => shareAmount(page), { timeout: 10_000 }).toBeGreaterThan(400)
    expect(await shareAmount(page)).toBeLessThan(470)
  })

  test('CD-F02: a rate-card item keeps its fixed down payment; the box shares out the rest', async ({
    page,
  }) => {
    await twoRows(page, ASTRON, 3)

    await expect(combinedInput(page)).toBeVisible({ timeout: 15_000 })
    // The ASTRON's card figure — fixed, shown as its share of the group.
    await expect(share(page)).toContainText('₱2,320.00')
    await expect(share(page)).toContainText('Rate card')
    await expect(combined(page)).toContainText('the rate card sets')

    await fillStable(combinedInput(page), '3000')
    await combinedInput(page).blur()
    await expect(combinedInput(page)).toHaveValue('3000.00')
    // The ASTRON is still ₱2,320; the fan carries the other ₱680.
    await expect(share(page)).toContainText('₱2,320.00')
    await expect(page.getByText(/2 items on inhouse installment/)).toContainText(
      'Down payment ₱3,000.00'
    )

    // Not enough to cover the rate card's own part.
    await fillStable(combinedInput(page), '2000')
    await expect(combined(page).getByTestId('down-payment-error')).toContainText(
      'the rate card sets for part of this'
    )
    // The sale still holds the last good figure, not the refused one.
    await combinedInput(page).blur()
    await expect(combinedInput(page)).toHaveValue('3000.00')
  })

  test('CD-F03: it can be small, never 0, and never more than the items cost', async ({ page }) => {
    await twoRows(page, AULA, 12)

    await fillStable(combinedInput(page), '0')
    await expect(combined(page).getByTestId('down-payment-error')).toContainText('not 0')

    await fillStable(combinedInput(page), '99999999')
    await expect(combined(page).getByTestId('down-payment-error')).toContainText('these items cost')

    await fillStable(combinedInput(page), '5')
    await expect(combined(page).getByTestId('down-payment-error')).toHaveCount(0)
  })

  test('CD-F04: items on different terms do not share a box — each keeps its own', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/checkout')
    await addInstallmentLine(page)
    await addItemToCart(page, AULA, 1)
    await expect(page.getByRole('button', { name: 'Inhouse Installment' })).toHaveCount(2, {
      timeout: 15_000,
    })
    await pickTerm(page, 12)
    await pickTerm(page, 6)

    await expect(combined(page)).toHaveCount(0)
    await expect(share(page)).toHaveCount(0)
    await expect(page.getByTestId('down-payment-input')).toHaveCount(2)
  })

  test('CD-F05: every TPF item shares one down payment too', async ({ page }) => {
    await gotoReady(page, '/pos/checkout')
    await addInstallmentLine(page)
    await addItemToCart(page, AULA, 1)
    const tpf = page.getByRole('button', { name: 'TPF Installment' })
    await expect(tpf).toHaveCount(2, { timeout: 15_000 })
    await tpf.nth(0).click()
    await tpf.nth(1).click()

    await expect(combined(page)).toHaveCount(1, { timeout: 15_000 })
    await expect(combined(page)).toContainText('on TPF installment')
    await expect(share(page)).toHaveCount(1)
    // Open — nothing on the rate card fixes a TPF down payment.
    await fillStable(combinedInput(page), '600')
    await combinedInput(page).blur()
    await expect(combinedInput(page)).toHaveValue('600.00')
  })
})
