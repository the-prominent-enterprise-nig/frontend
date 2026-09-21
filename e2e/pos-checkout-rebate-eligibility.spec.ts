import { test, expect, type Page } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Scenario 57 Part 2 — "Eligible for rebate" toggle in checkout's Payment
// Mode area. Persistence onto PosTransaction/InstallmentAccount (including
// through the release-form hold/replay) and both payment paths'
// rebate_not_eligible guard are covered by the backend
// (pos-installment-financing + collections-payment-rebate e2e specs); this
// spec covers the toggle itself: when it shows, its default, and its reset.
//
// A full submit isn't driven here: the isolated test DB has no WIP-priced
// stock at any branch (the old "Universal Remote Control" fixture other
// installment specs still search for is gone from the seed), and adding one
// means editing a live price list, which reverts it to pending approval
// for every other spec. Nothing is created, so nothing needs cleanup.

/** Any item stocked at the test DB's one open-session branch (Bago) —
 * a price isn't needed to reach Payment Mode. */
async function addItemToCart(page: Page): Promise<void> {
  const searchInput = page.getByPlaceholder('Search by name or serial')
  await expect(searchInput).toBeVisible({ timeout: 15_000 })
  await searchInput.fill('Capacitor')
  const card = page
    .getByRole('button')
    .filter({ has: page.getByText('Capacitor', { exact: true }) })
  await expect(card.first()).toBeVisible({ timeout: 10_000 })
  await card.first().click()
}

const rebateToggle = (page: Page) => page.getByTestId('rebate-eligible-toggle')
const rebateOption = (page: Page, name: 'Yes' | 'No') =>
  rebateToggle(page).getByRole('radio', { name, exact: true })

test.describe('POS Checkout — Eligible for rebate', () => {
  test('shows only for in-house installment, defaults to Yes, and resets when the cart leaves installment', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/checkout')
    await addItemToCart(page)

    // Cash (the default Payment Mode) — no toggle.
    await expect(page.getByText('Payment Mode', { exact: true })).toBeVisible()
    await expect(rebateToggle(page)).toHaveCount(0)

    await clickStable(
      page.getByRole('button', { name: 'Installment', exact: true }),
      rebateToggle(page)
    )
    await expect(rebateOption(page, 'Yes')).toHaveAttribute('aria-checked', 'true')
    await expect(rebateOption(page, 'No')).toHaveAttribute('aria-checked', 'false')

    await rebateOption(page, 'No').click()
    await expect(rebateOption(page, 'No')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByText(/won.t earn a prompt payment discount/i)).toBeVisible()

    // Leaving installment hides it; coming back starts from the default
    // again, so an opt-out can't silently carry into a different sale.
    await page.getByRole('button', { name: 'Cash', exact: true }).first().click()
    await expect(rebateToggle(page)).toHaveCount(0)
    await clickStable(
      page.getByRole('button', { name: 'Installment', exact: true }),
      rebateToggle(page)
    )
    await expect(rebateOption(page, 'Yes')).toHaveAttribute('aria-checked', 'true')
  })
})
