/**
 * Scenario 69 Part B — the CWT screen has to say that recording a certificate
 * posts nothing.
 *
 * The withheld slice settles the customer's invoice and is booked to
 * Creditable Withholding Tax when the payment is collected, so the 2307
 * that arrives later is only the paper behind an entry already on the books.
 * (Scenario 50 had it the other way round — the invoice stayed open and
 * recording the certificate posted it — and this screen said so.) A person
 * about to click "Record certificate" needs to know it will not post
 * anything, so the page says that outright.
 *
 * Read-only: opens the page and asserts its copy. Creates nothing, so there
 * is nothing to clean up and nothing lands in the dev database.
 */
import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

test.describe('Withholding Tax (CWT) — posting is explained on the screen', () => {
  test('the page says a withheld amount settles at collection and its certificate posts nothing', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/withholding-tax')

    await expect(page.getByRole('heading', { name: 'Withholding Tax (CWT)' })).toBeVisible()

    // The consequence a collector needs: an invoice with withholding on it is
    // paid, not waiting on the certificate.
    await expect(
      page.getByText(
        // `.` for the apostrophe: the page renders a typographic &rsquo;.
        /settles the customer.s invoice and is booked to Creditable Withholding Tax when the payment is collected/i
      )
    ).toBeVisible()
    await expect(page.getByText(/recording its certificate here posts nothing/i)).toBeVisible()
  })
})
