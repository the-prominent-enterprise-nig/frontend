import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'
import { addItemToCart, ITEM_QUERY } from './credit-application-checkout'

// A VAT-exempt or zero-rated sale charges the listed price (the LCP) as it is.
// The listed price is VAT-inclusive; a VATable sale takes the 12% out of it for
// the books, but an exempt or zero-rated sale takes nothing out and adds
// nothing, so the customer pays exactly the listed price. (Until 2026-10-28 the
// register stripped the 12% on those sales: a 21,000 LCP became 18,750.)
//
// No sale is submitted — the register is only driven as far as the total; the
// backend unit tests (transactions.service.spec.ts) cover the posting.

test.describe('POS checkout — the listed price on a VAT-exempt or zero-rated sale', () => {
  test.describe.configure({ timeout: 90_000 })

  test('EX-G01: the total stays the listed price, as it is on a VATable sale', async ({ page }) => {
    await gotoReady(page, '/pos/checkout')
    await addItemToCart(page, ITEM_QUERY)

    const total = page.getByTestId('order-summary-total')
    await expect(total).toBeVisible({ timeout: 30_000 })
    const listedPrice = (await total.innerText()).trim()
    expect(listedPrice).toMatch(/\d/)

    const treatment = page.getByTestId('vat-treatment')
    const restricted = page.getByTestId('vat-treatment-restricted')

    // VAT-exempt: nothing taken out of the price.
    await clickStable(treatment.getByRole('radio', { name: 'VAT-exempt' }), restricted)
    await expect(treatment.getByRole('radio', { name: 'VAT-exempt' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    await expect(total).toHaveText(listedPrice)

    // Zero-rated: the same.
    await treatment.getByRole('radio', { name: 'Zero-rated' }).click()
    await expect(treatment.getByRole('radio', { name: 'Zero-rated' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    await expect(total).toHaveText(listedPrice)

    // And back to VATable: still the listed price.
    await treatment.getByRole('radio', { name: 'VATable' }).click()
    await expect(total).toHaveText(listedPrice)
  })
})
