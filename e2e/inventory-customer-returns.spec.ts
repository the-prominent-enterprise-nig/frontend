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

/**
 * The create overlay, as a scope.
 *
 * It covers the returns list without unmounting it, and a list row is itself a
 * role="button" whose name carries the item — so an unscoped
 * getByRole('button', { name: /Widget/ }) matches a row behind the overlay as
 * readily as the purchase row in front of it, and picks whichever comes first
 * in the DOM. Everything inside the screen is queried through here.
 */
function screen(page: Page) {
  return page.getByRole('region', { name: 'New customer return' })
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

/**
 * The branch picker, which is a SearchableSelect rather than a native
 * <select> — 40-odd locations is a list nobody scrolls, so it is typed into.
 * Its options are absolutely positioned inside the control, not portalled,
 * so they stay inside the screen's own region.
 */
async function pickBranch(page: Page, label: string): Promise<void> {
  const input = screen(page).getByPlaceholder('Select branch…')
  await input.click()
  await input.fill(label)
  const option = screen(page)
    .getByTestId('searchable-select-option')
    .filter({ hasText: label })
    .first()
  await expect(option).toBeVisible({ timeout: 10_000 })
  await option.click()
}

/** The row for one of the fixture's purchases. */
function purchaseRow(page: Page, name: RegExp) {
  return screen(page).getByRole('button', { name }).first()
}

test.describe('Inventory — Customer returns (Scenario 18)', () => {
  test('nothing is offered until the customer is named', async ({ page }) => {
    await openReturnScreen(page)

    // The customer is the context the whole screen is read against, so it
    // lives in the header rather than in a step that gets completed and left
    // behind — and until it is answered there is nothing below it to answer.
    await expect(screen(page).getByText('Find the customer')).toBeVisible()

    // Nothing is guessed on their behalf: a business owner who can see every
    // branch has to say where they are standing.
    await expect(screen(page).getByPlaceholder('Select branch…')).toHaveValue('')

    // The bar says what is missing rather than greying out and leaving the
    // clerk to work out why.
    await expect(screen(page).getByText('No sale picked yet')).toBeVisible()
  })

  test('the bar names the first unanswered question, one at a time', async ({ page }) => {
    await openReturnScreen(page)
    await pickFixtureCustomer(page)
    await pickBranch(page, 'Bago')

    await expect(screen(page).getByText('Nothing ticked')).toBeVisible()

    const row = purchaseRow(page, /E2E Returns UI Widget/)
    await expect(
      row,
      'No purchase to pick — run e2e/fixtures/customer-return.sql against the test DB first.'
    ).toBeVisible({ timeout: 15_000 })
    await row.click()

    // Ticking it asks why before it asks anything else, and the disposition
    // is deliberately unanswered — the old form defaulted it to Restock and
    // sent nothing, which put damaged units back on the shelf.
    await expect(screen(page).getByText(/Needs a reason on/)).toBeVisible()

    await screen(page)
      .getByRole('combobox', { name: 'Reason for the return' })
      .selectOption({ label: 'Stopped working' })
    await expect(screen(page).getByText(/Needs a decision on/)).toBeVisible()

    await screen(page)
      .getByRole('button', { name: /Restock/ })
      .first()
      .click()
    await expect(screen(page).getByText('Ready to post')).toBeVisible()
  })

  test('quarantine, repair and scrap each ask what is wrong with it', async ({ page }) => {
    await openReturnScreen(page)
    await pickFixtureCustomer(page)
    await pickBranch(page, 'Bago')

    const row = purchaseRow(page, /E2E Returns UI Widget/)
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.click()
    await screen(page)
      .getByRole('combobox', { name: 'Reason for the return' })
      .selectOption({ label: 'Defective on arrival' })

    // Restock holds nothing back, so there is nothing for anyone downstream
    // to act on and nothing to write.
    await screen(page)
      .getByRole('button', { name: /Restock/ })
      .first()
      .click()
    await expect(screen(page).getByText('Held for inspection')).toBeHidden()

    await screen(page)
      .getByRole('button', { name: /Quarantine/ })
      .first()
      .click()
    await expect(screen(page).getByText('Held for inspection')).toBeVisible()
    await expect(screen(page).getByText(/Needs a fault note on/)).toBeVisible()

    // The copy changes with the consequence — a write-off is not an
    // inspection, and the person signing it off needs a different answer.
    await screen(page).getByRole('button', { name: /Scrap/ }).first().click()
    await expect(screen(page).getByText('Writing this unit off')).toBeVisible()

    await screen(page).getByLabel('Writing this unit off').fill('Cracked drum, beyond repair')
    await expect(screen(page).getByText('Ready to post')).toBeVisible()
  })

  test('the settlement reads across, and repairs refund nothing', async ({ page }) => {
    await openReturnScreen(page)
    await pickFixtureCustomer(page)
    await pickBranch(page, 'Bago')

    const row = purchaseRow(page, /E2E Returns UI Widget/)
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.click()
    await screen(page).getByRole('spinbutton', { name: 'Quantity coming back' }).fill('2')
    await screen(page)
      .getByRole('combobox', { name: 'Reason for the return' })
      .selectOption({ label: 'Changed their mind' })
    await screen(page)
      .getByRole('button', { name: /Restock/ })
      .first()
      .click()

    // Two units at the fixture's ₱1,200.
    await expect(screen(page).getByText('Refundable')).toBeVisible()
    await expect(screen(page).getByText('Customer gets back')).toBeVisible()
    await expect(screen(page).getByText('₱2,400.00').first()).toBeVisible()
    await expect(screen(page).getByText('2 units coming back')).toBeVisible()
  })

  test('posts a real return, and holds the RR number open until it is dismissed', async ({
    page,
  }) => {
    await openReturnScreen(page)
    await pickFixtureCustomer(page)
    await pickBranch(page, 'Bago')

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
    const qty = screen(page).getByRole('spinbutton', { name: 'Quantity coming back' })
    await expect(qty).toHaveValue('200')
    await qty.fill('1')

    await screen(page)
      .getByRole('combobox', { name: 'Reason for the return' })
      .selectOption({ label: 'Stopped working' })
    await screen(page)
      .getByRole('button', { name: /Restock/ })
      .first()
      .click()

    await screen(page).getByRole('button', { name: 'Post return' }).click()

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
    await pickBranch(page, 'Bago')

    const row = purchaseRow(page, /E2E Returns UI Tracked Unit/)
    await expect(
      row,
      'No tracked purchase — run e2e/fixtures/customer-return.sql against the test DB first.'
    ).toBeVisible({ timeout: 15_000 })
    await row.click()

    await screen(page)
      .getByRole('combobox', { name: 'Reason for the return' })
      .selectOption({ label: 'Warranty claim' })
    await screen(page)
      .getByRole('button', { name: /Exchange/ })
      .first()
      .click()

    // The unit going out is nameable, right there under the line, and the one
    // coming back is not among the options.
    const picker = screen(page).getByRole('combobox', { name: 'Replacement unit' })
    await expect(picker).toBeVisible({ timeout: 10_000 })
    await expect(picker.locator('option')).toContainText([
      /Pick a unit from stock/,
      /E2E-RETUI-SN-SHELF/,
    ])
    await expect(picker.locator('option', { hasText: 'E2E-RETUI-SN-SOLD' })).toHaveCount(0)

    // Until one is chosen the return cannot post — the server refuses it, so
    // letting the click through only moved the refusal later.
    await expect(screen(page).getByText(/Needs a replacement unit on/)).toBeVisible()
    await expect(
      screen(page).getByText('Pick the unit going out to settle the swap.')
    ).toBeVisible()

    await picker.selectOption({ label: 'E2E-RETUI-SN-SHELF' })

    // Same item, same price: the swap settles to nothing, and the ledger says
    // so rather than leaving the clerk to assume it.
    await expect(screen(page).getByText('Even swap')).toBeVisible()
    await expect(screen(page).getByText('Ready to post')).toBeVisible()
  })

  /**
   * A repair intake takes custody of one named unit, which the server insists
   * on — so the only line that can take one is a line whose sale recorded a
   * serial. Offered on any other, it asked for "the specific unit" from a row
   * with no way to name one: a dead end reached only after the return was
   * filled in.
   */
  test('repair is offered only where the sale named the unit', async ({ page }) => {
    await openReturnScreen(page)
    await pickFixtureCustomer(page)
    await pickBranch(page, 'Bago')

    const untracked = purchaseRow(page, /E2E Returns UI Widget/)
    await expect(untracked).toBeVisible({ timeout: 15_000 })
    await untracked.click()

    const repair = screen(page)
      .getByRole('button', { name: /Repair/ })
      .first()
    await expect(repair).toBeDisabled()
    await expect(repair).toContainText('no unit on record')

    // Untick it, so the only disposition grid on screen belongs to the row
    // ticked next.
    await untracked.click()

    const tracked = purchaseRow(page, /E2E Returns UI Tracked Unit/)
    await expect(tracked).toBeVisible()
    await tracked.click()
    await expect(
      screen(page)
        .getByRole('button', { name: /Repair/ })
        .first()
    ).toBeEnabled()
  })

  /**
   * The bug this covers: "is this serial-tracked?" had two answers.
   *
   * The screen read it off the sale line's serial, the server reads it off
   * the item — and for a tracked item sold without a serial on the line those
   * disagree. The form called that swap counted, said "nothing is credited",
   * took the post, and the server refused it with the return already filled
   * in: an exchange of a serial-tracked item needs the replacement unit.
   */
  test('a tracked item sold without a serial still needs a named replacement', async ({ page }) => {
    await openReturnScreen(page)
    await pickFixtureCustomer(page)
    await pickBranch(page, 'Bago')

    const row = purchaseRow(page, /E2E Returns UI Untracked Sale/)
    await expect(
      row,
      'No sale-without-serial purchase — run e2e/fixtures/customer-return.sql against the test DB first.'
    ).toBeVisible({ timeout: 15_000 })
    await row.click()

    await screen(page)
      .getByRole('combobox', { name: 'Reason for the return' })
      .selectOption({ label: 'Warranty claim' })
    await screen(page)
      .getByRole('button', { name: /Exchange/ })
      .first()
      .click()

    // Not "this item is not serial-tracked, so the swap is counted" — the
    // item is tracked, whatever its sale line recorded.
    const picker = screen(page).getByRole('combobox', { name: 'Replacement unit' })
    await expect(picker).toBeVisible({ timeout: 10_000 })
    await expect(picker.locator('option')).toContainText([
      /Pick a unit from stock/,
      /E2E-RETUI-SN-SPARE/,
    ])
    await expect(screen(page).getByText(/not serial-tracked/)).toBeHidden()

    // And the bar holds the post until one is named, rather than letting the
    // server say it afterwards.
    await expect(screen(page).getByText(/Needs a replacement unit on/)).toBeVisible()

    await picker.selectOption({ label: 'E2E-RETUI-SN-SPARE' })
    await expect(screen(page).getByText('Even swap')).toBeVisible()
    await expect(screen(page).getByText('Ready to post')).toBeVisible()
  })

  test('cancelling leaves the list where it was', async ({ page }) => {
    await openReturnScreen(page)
    await screen(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Customer return' })).toBeHidden()
  })

  /**
   * A walk-in has no account to look up, and a return's customer is nullable
   * precisely for them — but the screen only knew how to start from a named
   * account, so a cash customer holding a receipt had no path through it.
   */
  test('a walk-in is found by the number on their receipt', async ({ page }) => {
    await openReturnScreen(page)

    const lookup = screen(page).getByRole('searchbox', {
      name: 'Invoice or transaction number',
    })
    await expect(lookup).toBeVisible()

    // Searched as it is typed — no button to press, which is the point of it.
    await lookup.fill('SI-E2E-RETUI-01')

    // The sale's own lines, reached without ever naming the customer.
    await expect(purchaseRow(page, /E2E Returns UI Widget/)).toBeVisible({ timeout: 15_000 })

    // And the bar stops reporting a missing customer as the outstanding
    // problem, which is a field this clerk is right to leave empty.
    await expect(screen(page).getByText('No sale picked yet')).toBeHidden()
  })

  test('a receipt number that matches nothing says so, and keeps the box', async ({ page }) => {
    await openReturnScreen(page)

    await screen(page)
      .getByRole('searchbox', { name: 'Invoice or transaction number' })
      .fill('SI-DOES-NOT-EXIST')

    await expect(screen(page).getByText(/No sale found for/)).toBeVisible({ timeout: 15_000 })
    // A mistyped number is the likeliest reason to be standing here, so the
    // box stays put above the message — still holding what was typed, so the
    // correction is an edit rather than a retype.
    const lookup = screen(page).getByRole('searchbox', {
      name: 'Invoice or transaction number',
    })
    await expect(lookup).toBeVisible()
    await expect(lookup).toHaveValue('SI-DOES-NOT-EXIST')
  })
})

/**
 * The list the screen posts into.
 *
 * It was written for the single-ledger-row return that predates the document,
 * and a multi-line document arrives with no one item, no one serial and no
 * one condition by design — so these cover the cells that used to render a
 * dash, and the search box that had to be paged around.
 */
test.describe('Inventory — Returns list (Scenario 18)', () => {
  test('one box searches every number a customer could quote', async ({ page }) => {
    await gotoReady(page, '/inventory/returns')

    const search = page.getByRole('searchbox', { name: 'Search returns' })
    await expect(search).toBeVisible()

    // Retried on the effect, not on the value. This runs straight after a
    // navigation and the box is a controlled input, so typing before hydration
    // sets the DOM value and React's own empty state then wipes it — the
    // failure screenshot showed the caret sitting in an empty box with the
    // list unfiltered. fillStable is not enough here either: it proves the
    // value at the instant it checks, and the wipe can land after that. Only
    // the filtered result proves the keystrokes reached React.
    await expect(async () => {
      await search.fill('NOTHING-MATCHES-THIS-AT-ALL')
      await expect(page.getByText('No returns match', { exact: true })).toBeVisible({
        timeout: 5_000,
      })
    }).toPass({ timeout: 30_000 })
    // The empty state quotes back what was typed, so it is obvious which of
    // the filters produced nothing.
    await expect(page.getByText(/NOTHING-MATCHES-THIS-AT-ALL/)).toBeVisible()

    // The way back is offered rather than left to be worked out.
    await page.getByRole('button', { name: 'Clear search and filters' }).click()
    await expect(search).toHaveValue('')
  })

  test('the outcome band narrows to one shape of record', async ({ page }) => {
    await gotoReady(page, '/inventory/returns')

    const repairs = page.getByRole('button', { name: /Repair intakes/ })
    await expect(repairs).toBeVisible()
    await repairs.click()

    // Whatever comes back, nothing that is not a repair intake may: the three
    // arms are unioned server-side and the filter has to reach all of them.
    await expect(repairs).toHaveAttribute('aria-pressed', 'true')
    // Counted, not read as text: not.toContainText() fails outright when the
    // locator matches nothing, and a branch with no repair intakes renders the
    // empty state instead of a table — so the assertion blew up on exactly the
    // result that satisfies it. toHaveCount(0) is true whether the rows are
    // absent or the table is.
    await expect(page.locator('tbody tr', { hasText: 'Return document' })).toHaveCount(0)
    await expect(page.locator('tbody tr', { hasText: 'from POS' })).toHaveCount(0)

    // Pressing the card again is the way back out — it is a toggle, not a
    // one-way narrowing that has to be undone from Clear filters.
    await repairs.click()
    await expect(repairs).toHaveAttribute('aria-pressed', 'false')
  })

  /**
   * The references used to stack four-deep inside the row's Outcome cell, and
   * the two that live in the ledger were not there at all. They are one card
   * now, and the card's job is to separate "no credit memo because it was a
   * cash return" from "no credit memo and somebody should chase it".
   */
  test('the panel names every document, and says which are outstanding', async ({ page }) => {
    await gotoReady(page, '/inventory/returns')

    const firstRow = page.locator('tbody tr[role="button"]').first()
    await expect(firstRow).toBeVisible({ timeout: 20_000 })
    await firstRow.click()

    await expect(page.getByText('Paperwork')).toBeVisible()
    for (const label of ['Return doc', 'RR issued', 'Credit memo', 'Journal entry', 'Against SI']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible()
    }

    // Either every document is on file or the panel says how many are not.
    await expect(page.getByText(/^(Complete|\d+ outstanding)$/)).toBeVisible()
  })

  /**
   * A customer who lost the copy they walked out with is the whole reason to
   * come back to one of these rows. The paper was reachable for the few
   * seconds the posted dialog was on screen and nowhere after that.
   */
  test('the customer copy can be reprinted from the row', async ({ page }) => {
    await gotoReady(page, '/inventory/returns')

    // Only a return raised as a document has a copy to reprint — a legacy
    // single-ledger-row return has no header behind it.
    const row = page.locator('tbody tr[role="button"]', { hasText: 'Return document' }).first()
    await expect(row).toBeVisible({ timeout: 20_000 })
    await row.click()

    const print = page.getByRole('button', { name: 'Print customer copy' })
    await expect(print).toBeVisible()

    // It opens its own window — printing in place would hand the customer
    // the dashboard's sidebar.
    const [copy] = await Promise.all([page.waitForEvent('popup'), print.click()])
    await expect(copy.getByRole('heading', { name: 'Receiving Report' })).toBeVisible({
      timeout: 15_000,
    })
    // The RRC is the number on the customer's paper, so it leads.
    await expect(copy.getByText(/^RRC-/)).toBeVisible()
    await copy.close()
  })
})
