/**
 * Scenario 50 — the CWT screen has to say that recording a certificate posts.
 *
 * The withheld slice no longer settles anything at collection time: the
 * collection entry is the cash alone and the invoice keeps that amount open
 * until the 2307 arrives. That makes this screen the place the withholding
 * actually posts, and a person about to click "Record certificate" needs to
 * know that before they click it — the screen previously said nothing at all
 * about posting.
 *
 * Read-only: opens the page and asserts its copy. Creates nothing, so there
 * is nothing to clean up and nothing lands in the dev database.
 */
import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

test.describe('Withholding Tax (CWT) — posting is explained on the screen', () => {
  test('the page says a withheld amount stays open until its certificate is recorded', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/withholding-tax')

    await expect(page.getByRole('heading', { name: 'Withholding Tax (CWT)' })).toBeVisible()

    // The consequence a collector needs: an invoice reading as owing is not
    // necessarily an unpaid customer.
    await expect(
      page.getByText(
        // `.` for the apostrophe: the page renders a typographic &rsquo;.
        /stays open on the customer.s invoice until its certificate is recorded here/i
      )
    ).toBeVisible()
  })
})
