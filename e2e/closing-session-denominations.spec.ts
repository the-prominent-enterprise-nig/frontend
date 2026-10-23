import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Scenario 53 — the close-session denomination grid.
 *
 * The grid used to stop at ₱20, which made any drawer holding coins
 * impossible to declare: a ₱9,273.50 count had nowhere to put the ₱3 or the
 * ₱0.50. It now runs down to ₱1 and carries a lump Coins line, mirroring the
 * denomination block on the client's own Daily Collection Report form.
 *
 * Read-only: opens the modal, types a count, asserts the computed total, then
 * dismisses without submitting — so it never closes a real session or leaves
 * anything behind to clean up.
 *
 * Backend coverage for what actually gets persisted lives in
 * backend/test/closing-session-record.e2e-spec.ts.
 */
test.describe('POS — close session denomination grid', () => {
  test('counts down to ₱1 plus a coins line, and totals to the centavo', async ({
    page,
  }, testInfo) => {
    await gotoReady(page, '/pos/sessions')

    const closeButton = page.getByRole('button', { name: 'Close Session' }).first()
    if ((await closeButton.count()) === 0) {
      // No open session on this seed — the grid is only reachable from one.
      // Annotate rather than pass silently, per this suite's convention.
      testInfo.annotations.push({
        type: 'skipped-assertion',
        description:
          'No open POS session on the seeded DB, so the Close Session modal is unreachable. ' +
          'Open a session at /pos/sessions (or run the POS seed) and re-run.',
      })
      return
    }

    await closeButton.click()
    await expect(page.getByRole('heading', { name: 'Close Session' })).toBeVisible()

    // Every denomination a cashier can actually hold, including the three
    // that were missing entirely before this change.
    for (const denomination of [1000, 500, 200, 100, 50, 20, 10, 5, 1]) {
      await expect(page.getByLabel(`${denomination} peso count`)).toBeVisible()
    }
    const coins = page.getByLabel('Loose coin total')
    await expect(coins).toBeVisible()

    // The exact count that motivated the change: 9x1000 + 2x100 + 1x50 +
    // 1x20 + 3x1 + 0.50 of coin = 9,273.50.
    await page.getByLabel('1000 peso count').fill('9')
    await page.getByLabel('100 peso count').fill('2')
    await page.getByLabel('50 peso count').fill('1')
    await page.getByLabel('20 peso count').fill('1')
    await page.getByLabel('1 peso count').fill('3')
    await coins.fill('0.50')

    // Centavos must survive into the total — it previously rendered via a
    // bare toLocaleString(), which dropped them.
    await expect(page.getByRole('button', { name: /Close Session \(₱9,273\.50\)/ })).toBeVisible()

    // Leave without closing the session.
    await page.keyboard.press('Escape')
  })
})
