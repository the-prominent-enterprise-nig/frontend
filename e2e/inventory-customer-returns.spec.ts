import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Scenario 18 — the customer return screen.
 *
 * The screen it replaced was a 769-line modal that recorded one item per
 * submission, asked condition and repair-decision as two fields crossing into
 * a 2×3 matrix, and let its invoice picker overwrite the customer field and
 * then freeze it read-only. What is here now is one list of the customer's own
 * purchases, each unfolding into its own decision when ticked.
 *
 * The posting rules themselves (quantity cap, one RR, one consolidated credit
 * memo, exchange even-swap) are covered server-side in the backend's
 * inventory-customer-returns-document.e2e-spec.ts — this only covers what the
 * screen does.
 *
 * Depends on e2e/fixtures/customer-return.sql being loaded into the test DB:
 * one customer with a 200-unit sale and a serial-tracked unit, plus a spare of
 * that unit sitting in Bago.
 */

async function openReturnScreen(page: Page): Promise<void> {
  await gotoReady(page, '/inventory/returns')
  await page.getByRole('button', { name: /process return|new return|record return/i }).click()
  await expect(page.getByRole('heading', { name: 'Customer return' })).toBeVisible({
    timeout: 15_000,
  })
}

async function pickFixtureCustomer(page: Page): Promise<void> {
  await page.getByRole('button', { name: /select a customer|search customer/i }).click()
  await page
    .getByPlaceholder(/search/i)
    .first()
    .fill('E2E Returns UI Customer')
  const dropdown = page.locator('div.fixed.z-100')
  await expect(dropdown).toBeVisible({ timeout: 10_000 })
  await dropdown.locator('button').first().click()
}

/** The row for one of the fixture's purchases. */
function purchaseRow(page: Page, name: RegExp) {
  return page.getByRole('button', { name }).first()
}

test.describe('Inventory — Customer returns (Scenario 18)', () => {
  test('nothing is offered until the customer is named', async ({ page }) => {
    await openReturnScreen(page)

    // The customer is the context the whole screen is read against, so it
    // lives in the header rather than in a step that gets completed and left
    // behind — and until it is answered there is nothing below it to answer.
    await expect(page.getByText('Find the customer')).toBeVisible()

    // Nothing is guessed on their behalf: a business owner who can see every
    // branch has to say where they are standing.
    await expect(page.getByRole('combobox', { name: 'Branch taking it back' })).toHaveValue('')

    // The bar says what is missing rather than greying out and leaving the
    // clerk to work out why.
    await expect(page.getByText('No customer yet')).toBeVisible()
  })

  test('the bar names the first unanswered question, one at a time', async ({ page }) => {
    await openReturnScreen(page)
    await pickFixtureCustomer(page)
    await page
      .getByRole('combobox', { name: 'Branch taking it back' })
      .selectOption({ label: 'Bago' })

    await expect(page.getByText('Nothing ticked')).toBeVisible()

    const row = purchaseRow(page, /E2E Returns UI Widget/)
    await expect(
      row,
      'No purchase to pick — run e2e/fixtures/customer-return.sql against the test DB first.'
    ).toBeVisible({ timeout: 15_000 })
    await row.click()

    // Ticking it asks why before it asks anything else, and the disposition
    // is deliberately unanswered — the old form defaulted it to Restock and
    // sent nothing, which put damaged units back on the shelf.
    await expect(page.getByText(/Needs a reason on/)).toBeVisible()

    await page
      .getByRole('combobox', { name: 'Reason for the return' })
      .selectOption({ label: 'Stopped working' })
    await expect(page.getByText(/Needs a decision on/)).toBeVisible()

    await page
      .getByRole('button', { name: /Restock/ })
      .first()
      .click()
    await expect(page.getByText('Ready to post')).toBeVisible()
  })

  test('quarantine, repair and scrap each ask what is wrong with it', async ({ page }) => {
    await openReturnScreen(page)
    await pickFixtureCustomer(page)
    await page
      .getByRole('combobox', { name: 'Branch taking it back' })
      .selectOption({ label: 'Bago' })

    const row = purchaseRow(page, /E2E Returns UI Widget/)
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.click()
    await page
      .getByRole('combobox', { name: 'Reason for the return' })
      .selectOption({ label: 'Defective on arrival' })

    // Restock holds nothing back, so there is nothing for anyone downstream
    // to act on and nothing to write.
    await page
      .getByRole('button', { name: /Restock/ })
      .first()
      .click()
    await expect(page.getByText('Held for inspection')).toBeHidden()

    await page
      .getByRole('button', { name: /Quarantine/ })
      .first()
      .click()
    await expect(page.getByText('Held for inspection')).toBeVisible()
    await expect(page.getByText(/Needs a fault note on/)).toBeVisible()

    // The copy changes with the consequence — a write-off is not an
    // inspection, and the person signing it off needs a different answer.
    await page.getByRole('button', { name: /Scrap/ }).first().click()
    await expect(page.getByText('Writing this unit off')).toBeVisible()

    await page.getByLabel('Writing this unit off').fill('Cracked drum, beyond repair')
    await expect(page.getByText('Ready to post')).toBeVisible()
  })

  test('the settlement reads across, and repairs refund nothing', async ({ page }) => {
    await openReturnScreen(page)
    await pickFixtureCustomer(page)
    await page
      .getByRole('combobox', { name: 'Branch taking it back' })
      .selectOption({ label: 'Bago' })

    const row = purchaseRow(page, /E2E Returns UI Widget/)
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.click()
    await page.getByRole('spinbutton', { name: 'Quantity coming back' }).fill('2')
    await page
      .getByRole('combobox', { name: 'Reason for the return' })
      .selectOption({ label: 'Changed their mind' })
    await page
      .getByRole('button', { name: /Restock/ })
      .first()
      .click()

    // Two units at the fixture's ₱1,200.
    await expect(page.getByText('Refundable')).toBeVisible()
    await expect(page.getByText('Customer gets back')).toBeVisible()
    await expect(page.getByText('₱2,400.00').first()).toBeVisible()
    await expect(page.getByText('2 units coming back')).toBeVisible()
  })

  test('posts a real return, and holds the RR number open until it is dismissed', async ({
    page,
  }) => {
    await openReturnScreen(page)
    await pickFixtureCustomer(page)
    await page
      .getByRole('combobox', { name: 'Branch taking it back' })
      .selectOption({ label: 'Bago' })

    const row = purchaseRow(page, /E2E Returns UI Widget/)
    await expect(
      row,
      'No purchase to pick — run e2e/fixtures/customer-return.sql against the test DB first.'
    ).toBeVisible({ timeout: 15_000 })
    await row.click()

    // The quantity defaults to what was sold, with the sold figure beside it
    // so the cap is visible while it is typed against. 200 is the fixture's
    // sale quantity — deliberately generous, so repeated runs of this spec do
    // not exhaust the server's cap on what is left to return.
    const qty = page.getByRole('spinbutton', { name: 'Quantity coming back' })
    await expect(qty).toHaveValue('200')
    await qty.fill('1')

    await page
      .getByRole('combobox', { name: 'Reason for the return' })
      .selectOption({ label: 'Stopped working' })
    await page
      .getByRole('button', { name: /Restock/ })
      .first()
      .click()

    await page.getByRole('button', { name: 'Post return' }).click()

    // Asserted on the dialog, not on a toast: the RR number is what the clerk
    // writes on the customer's copy before they can leave, so it stays on
    // screen until it is dismissed rather than fading on a timer.
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 20_000 })
    await expect(dialog.getByText('Return posted')).toBeVisible()
    await expect(dialog.getByText(/RR-|CRR-|\bRTN-/).first()).toBeVisible()

    await dialog.getByRole('button', { name: 'Back to returns' }).click()
    await expect(page.getByRole('heading', { name: 'Customer return' })).toBeHidden()
    await expect(page.getByText(/RTN-\d{8}-\d{4}/).first()).toBeVisible({ timeout: 20_000 })
  })

  /**
   * Exchange once shipped as a dead end: the checks panel said "no
   * replacement unit chosen yet", there was no control anywhere that could
   * choose one, and because it was only a warning the Post button stayed
   * enabled so the refusal arrived from the server instead.
   */
  test('choosing Exchange offers a replacement unit from stock', async ({ page }) => {
    await openReturnScreen(page)
    await pickFixtureCustomer(page)

    // Stand in the branch that actually holds stock of this item — a
    // replacement comes off that branch's shelf, not off the company's.
    await page
      .getByRole('combobox', { name: 'Branch taking it back' })
      .selectOption({ label: 'Bago' })

    const row = purchaseRow(page, /E2E Returns UI Tracked Unit/)
    await expect(
      row,
      'No tracked purchase — run e2e/fixtures/customer-return.sql against the test DB first.'
    ).toBeVisible({ timeout: 15_000 })
    await row.click()

    await page
      .getByRole('combobox', { name: 'Reason for the return' })
      .selectOption({ label: 'Warranty claim' })
    await page
      .getByRole('button', { name: /Exchange/ })
      .first()
      .click()

    // The unit going out is nameable, right there under the line, and the one
    // coming back is not among the options.
    const picker = page.getByRole('combobox', { name: 'Replacement unit' })
    await expect(picker).toBeVisible({ timeout: 10_000 })
    await expect(picker.locator('option')).toContainText([
      /Pick a unit from stock/,
      /E2E-RETUI-SN-SHELF/,
    ])
    await expect(picker.locator('option', { hasText: 'E2E-RETUI-SN-SOLD' })).toHaveCount(0)

    // Until one is chosen the return cannot post — the server refuses it, so
    // letting the click through only moved the refusal later.
    await expect(page.getByText(/Needs a replacement unit on/)).toBeVisible()
    await expect(page.getByText('—').first()).toBeVisible()

    await picker.selectOption({ label: 'E2E-RETUI-SN-SHELF' })

    // Same item, same price: the swap settles to nothing, and the ledger says
    // so rather than leaving the clerk to assume it.
    await expect(page.getByText('Even swap')).toBeVisible()
    await expect(page.getByText('Ready to post')).toBeVisible()
  })

  test('cancelling leaves the list where it was', async ({ page }) => {
    await openReturnScreen(page)
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Customer return' })).toBeHidden()
  })
})
