import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Scenario 03, Part 3 — "Reserve" checkout mode. This spec sticks to
// UI-surface checks (mode selector, deposit-labelled payment section, the
// customer-required notice) — same split pos-checkout-catalog.spec.ts uses:
// the actual SkuReservation/CustomerAdvance creation and branch-scoping
// logic is covered by the backend e2e suite
// (test/sku-reservations.e2e-spec.ts, test/customer-advances.e2e-spec.ts).
test.describe('POS Checkout — Reserve Mode', () => {
  test('selecting Reserve relabels Payment to an optional deposit and requires a customer', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/checkout')

    const depositHeading = page.getByText('Deposit (optional)', { exact: true })
    await clickStable(page.getByRole('button', { name: /^Reserve/ }), depositHeading)

    await expect(depositHeading).toBeVisible()
    await expect(page.getByText('A customer must be selected to reserve an item.')).toBeVisible()
    await expect(
      page.getByText(/Reserves one item by SKU.*picking another item replaces it/)
    ).toBeVisible()

    // Cart is empty — Confirm stays disabled with the shared empty-cart label
    // regardless of mode.
    await expect(page.getByRole('button', { name: 'Add items to continue' })).toBeDisabled()
  })

  test('other modes do not show the Reserve-only notices', async ({ page }) => {
    await gotoReady(page, '/pos/checkout')

    await expect(page.getByText('Deposit (optional)', { exact: true })).toHaveCount(0)
    await expect(page.getByText('A customer must be selected to reserve an item.')).toHaveCount(0)
  })
})
