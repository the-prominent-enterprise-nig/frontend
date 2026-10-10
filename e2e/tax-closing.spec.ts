/**
 * Scenario 69 Part H — the Tax Closing screens.
 *
 * The run list, the Settle VAT page and the Remit withholding tax page. The
 * point of them is that the entry is SHOWN before it is posted and that a run
 * which cannot be posted says why.
 *
 * Read-only: posting a settlement writes journal entries that a UI spec has no
 * way to delete, so this spec only drives the pages up to the button. Posting,
 * the reversal and what they do to the reports are exercised against the API by
 * backend/test/scenario-69-tax-closing.e2e-spec.ts and end to end in a real
 * browser by the Part H walkthrough.
 *
 * Needs the Part H migration applied to the DB the stack runs against.
 */
import { test, expect } from '@playwright/test'
import { fillStable, gotoReady } from './utils'

test.describe('Tax Closing', () => {
  test('the list says where each kind of run stands and offers both', async ({ page }) => {
    await gotoReady(page, '/accounting/tax-closing')
    await expect(page.getByRole('heading', { name: 'Tax Closing' })).toBeVisible()
    await expect(page.getByTestId('last-VAT_SETTLEMENT')).toContainText('VAT settlement')
    await expect(page.getByTestId('last-WHT_REMITTANCE')).toContainText(
      'Withholding tax remittance'
    )
    await expect(page.getByTestId('closing-table')).toBeVisible()
    await expect(page.getByTestId('new-vat')).toBeVisible()
    await expect(page.getByTestId('new-wht')).toBeVisible()
  })

  test('the two buttons open full pages, not dialogs', async ({ page }) => {
    await gotoReady(page, '/accounting/tax-closing')
    await expect(async () => {
      await page.getByTestId('new-vat').click()
      await expect(page).toHaveURL(/\/accounting\/tax-closing\/vat\/new/, { timeout: 2_000 })
    }).toPass({ timeout: 15_000 })
    // a page of its own, with a way back: the client does not want create flows in dialogs
    await expect(page.getByRole('heading', { name: 'Settle VAT' })).toBeVisible()
    await expect(page.getByRole('link', { name: /back to tax closing/i })).toBeVisible()
  })

  test('Settle VAT defaults to the end of last month and says when there is nothing to settle', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/tax-closing/vat/new?asOf=2000-01-31')
    await expect(page.getByLabel('Settle VAT through', { exact: true })).toHaveValue('2000-01-31')
    await expect(page.getByTestId('settle-blockers')).toContainText('nothing to settle', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('post-settlement')).toBeDisabled()
    // no entry to post when nothing is cleared
    await expect(page.getByTestId('settle-entry')).toHaveCount(0)
  })

  test('Settle VAT shows the entry it would post, balanced, for a day that has something', async ({
    page,
  }) => {
    // Today: whatever the books hold is previewed, if there is anything.
    await gotoReady(page, '/accounting/tax-closing/vat/new')
    await expect(page.getByTestId('settle-output')).toBeVisible({ timeout: 15_000 })
    const entry = page.getByTestId('settle-entry')
    if ((await entry.count()) > 0) {
      const lines = entry.getByTestId('entry-line')
      expect(await lines.count()).toBeGreaterThanOrEqual(2)
      // the entry's two sides are the same figure
      const totals = (await entry.locator('tfoot td').allInnerTexts()).slice(-2)
      expect(totals[0].trim()).toBe(totals[1].trim())
      // debits first, then credits: a posted entry reads like its preview
      const sides = await lines.evaluateAll((rows) =>
        rows.map((tr) => ((tr.children[2] as HTMLElement).innerText.trim() ? 'D' : 'C'))
      )
      expect(sides.join('')).toMatch(/^D+C+$/)
    } else {
      await expect(page.getByTestId('settle-blockers')).toBeVisible()
    }
  })

  test('Settle VAT refuses a day that has not happened', async ({ page }) => {
    await gotoReady(page, '/accounting/tax-closing/vat/new?asOf=2000-01-31')
    await expect(page.getByTestId('settle-blockers')).toBeVisible({ timeout: 15_000 })
    await fillStable(page.getByLabel('Settle VAT through', { exact: true }), '2999-01-01')
    await expect(page.getByTestId('settle-error')).toContainText('already happened')
    await expect(page.getByTestId('post-settlement')).toHaveCount(0)
  })

  test('Remit withholding tax asks for a bank, and a payment date that is not before the day covered', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/tax-closing/wht/new?asOf=2000-01-31')
    await expect(page.getByLabel('Remit through', { exact: true })).toHaveValue('2000-01-31')
    await expect(page.getByLabel('Paid from', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Payment date', { exact: true })).toHaveValue('2000-01-31')
    await expect(page.getByTestId('remit-blockers')).toContainText('nothing to remit', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('post-remittance')).toBeDisabled()

    // A payment date before the day it covers is said, not sent.
    await fillStable(page.getByLabel('Payment date', { exact: true }), '1999-12-01')
    await expect(page.getByTestId('remit-error')).toContainText(
      'cannot be earlier than the day the remittance covers'
    )
  })

  test('Remit withholding tax lists what each withholding account owes', async ({ page }) => {
    await gotoReady(page, '/accounting/tax-closing/wht/new')
    await expect(page.getByTestId('remit-balances')).toBeVisible({ timeout: 15_000 })
    // the three withholding accounts: general, rent and professional fees
    await expect(page.getByTestId('remit-balance')).toHaveCount(3)
    await expect(page.getByTestId('remit-balances')).toContainText('2-01-240')
    await expect(page.getByTestId('remit-balances')).toContainText('2-01-241')
    await expect(page.getByTestId('remit-balances')).toContainText('2-01-242')
  })

  test('a run that is not there says so', async ({ page }) => {
    await gotoReady(page, '/accounting/tax-closing/not-a-real-run')
    await expect(page.locator('.text-red-700').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('run-number')).toHaveCount(0)
  })
})
