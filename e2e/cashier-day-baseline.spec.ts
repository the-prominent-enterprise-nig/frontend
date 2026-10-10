import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Cashier day baseline, on screen.
 *
 * The client's sample day — "Cashier's sample 1Day Transactions", committed
 * verbatim at docs/reference/cashier-sample-1day-transactions.csv and
 * explained in docs/cashier-day-baseline.md — rung up at one branch, then read
 * back off the two sheets the branch actually prints: the Daily Collection
 * Report and the Daily Sales Monitoring sheet.
 *
 * The ledger behind these figures is asserted in the backend's own baseline
 * (backend/test/cashier-day-baseline.e2e-spec.ts, against the isolated test
 * database). This spec is the other half: that the same day reaches the
 * screen, to the centavo. Every figure here is the same constant, named the
 * same way, in backend/test/fixtures/cashier-day-baseline.ts — when one side
 * changes, change both.
 *
 * It needs the baseline day in the database the dev server is reading, which
 * is not something an e2e spec may write (the backend fences its e2e specs off
 * from any non-test database). Seed it deliberately, once:
 *
 *   cd ../backend && DOTENV_CONFIG_PATH=.env.test npx ts-node -r dotenv/config \
 *     -r tsconfig-paths/register scripts/seed-cashier-day-baseline.ts
 *
 * Seed it with the e2e stack already up: a cold `start:e2e` resets that
 * database, so a day seeded before the servers boot is gone by the time the
 * first test runs.
 *
 * Without it, these tests skip rather than fail — a missing fixture is not a
 * regression.
 */

const BASELINE_BRANCH = 'E2E Cashier Day Baseline Branch'

const SEED_HINT =
  'The cashier day baseline is not in this database — seed it with ' +
  'backend/scripts/seed-cashier-day-baseline.ts, with the e2e stack already ' +
  'up (see this file’s header).'

/**
 * Opens the baseline branch's sheet from the owner's roll-up. Returns false
 * when the branch is not there at all, which is the signal to skip.
 */
async function openBaselineBranch(page: Page): Promise<boolean> {
  await gotoReady(page, '/pos/daily-collection')
  const branch = page.getByRole('button', { name: BASELINE_BRANCH, exact: true }).first()
  try {
    // The roll-up fetches every branch's day, so the row is not there the
    // moment the document is. A bare count() here reads 0 off a page that is
    // still loading and skips a baseline that is present.
    await branch.waitFor({ state: 'visible', timeout: 30_000 })
  } catch {
    return false
  }
  await branch.click()
  await expect(page.getByRole('heading', { name: 'Daily Collection Report' })).toBeVisible()
  return true
}

/** The figure column is monospaced and formatted `15,000.00`. */
function figure(page: Page, amount: string) {
  return page.getByText(amount, { exact: true })
}

/**
 * The row a label sits on: its own parent element, not an ancestor filtered by
 * text — every wrapper up to the page would match that, and `.first()` would
 * pick the widest one rather than the row.
 */
function row(scope: Page | ReturnType<Page['locator']>, label: string) {
  return scope.getByText(label, { exact: true }).first().locator('..')
}

test.describe('POS — the cashier day baseline on screen', () => {
  test('the Daily Collection Report reads back the sheet’s own collections', async ({ page }) => {
    test.skip(!(await openBaselineBranch(page)), SEED_HINT)

    // The cash ledger, line for line: the counter sale, the delivery charge
    // and the advance instalment — the sheet's CASH of 17,425.00.
    await expect(figure(page, '15,000.00').first()).toBeVisible()
    await expect(figure(page, '1,925.00').first()).toBeVisible()
    await expect(figure(page, '500.00').first()).toBeVisible()
    await expect(row(page, 'Total cash')).toContainText('17,425.00')

    // The non-cash block: the card down payment, the two QR/e-wallet
    // collections (3,500.00 of Soundpay and Maya QR, 2,940.00 of ECPay on its
    // own DP line) and the three financiers' balances.
    await expect(figure(page, '7,500.00').first()).toBeVisible()
    await expect(figure(page, '3,500.00').first()).toBeVisible()
    await expect(figure(page, '2,940.00').first()).toBeVisible()
    await expect(figure(page, '76,000.00').first()).toBeVisible()

    // What the screen totals the day at today. The client's own sheet says
    // 87,365.00: the 76,000.00 of TPF balances is money no one has collected
    // yet, and the 56,000.00 bond check taken on a New Receipt is missing
    // altogether. Both are tracked as gap tests G7 and G3 in the backend
    // baseline — the figure here is deliberately the current one, so this
    // test fails the moment either is fixed and both sheets move together.
    await expect(row(page, 'Grand total collected')).toContainText('107,365.00')
    await expect(page.getByText('56,000.00', { exact: true })).toHaveCount(0)
  })

  test('the Daily Sales Monitoring sheet reads back the day’s three cuts', async ({ page }) => {
    test.skip(!(await openBaselineBranch(page)), SEED_HINT)

    await page.getByRole('tab', { name: 'Sales monitoring' }).click()
    await expect(
      page.getByRole('heading', { name: 'Daily Sales & Collection Monitoring' })
    ).toBeVisible()
    const sheet = page.locator('.print-sheet')

    // Per category, gross — the tag prices the customers paid.
    await expect(row(sheet, 'Appliances')).toContainText('49,500.00')
    await expect(row(sheet, 'Non-3E')).toContainText('52,500.00')
    await expect(row(sheet, 'Split type')).toContainText('19,600.00')
    await expect(row(sheet, 'Total sales')).toContainText('121,600.00')

    // The other two cuts of the same sales: nothing was sold by an agent, and
    // only the counter sale was a cash invoice.
    await expect(row(sheet, 'Office sales')).toContainText('121,600.00')
    await expect(row(sheet, 'Cash invoice (COD)')).toContainText('15,000.00')
    await expect(row(sheet, 'Charge invoice')).toContainText('106,600.00')
  })

  /**
   * The sheet's second act. The client's annotation says the closing's whole
   * 87,365.00 goes to Undeposited Funds and clears as one entry itemised
   * across five banks, with the Record deposit amount left blank for
   * accounting to fill in. What the screen shows today is the drawer alone,
   * at an amount the system worked out itself — gaps G8 and G12 in
   * docs/cashier-day-baseline.md.
   */
  test('Undeposited Funds shows the drawer banked, not the day', async ({ page }) => {
    test.skip(!(await openBaselineBranch(page)), SEED_HINT)

    await gotoReady(page, '/pos/undeposited-funds')
    // Scope the cards to this branch, so another branch's deposits cannot
    // stand in for the baseline's.
    await page.getByRole('textbox', { name: 'All branches' }).fill('E2E Cashier')
    await page.getByText(BASELINE_BRANCH, { exact: false }).first().click()

    // One deposit posted, for the drawer's 17,425.00 — not the closing's
    // 87,365.00, and not itemised across the five banks the sheet names.
    const cleared = page
      .getByText(/^Cleared/)
      .first()
      .locator('..')
    await expect(cleared).toContainText('17,425.00')
    await expect(cleared).toContainText('1 deposit posted')
    await expect(page.getByText('87,365.00', { exact: false })).toHaveCount(0)
  })
})
