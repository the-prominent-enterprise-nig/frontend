import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Scenario 37 — /settings/payment-methods manages the named sub-choices
// under Card/Bank Transfer/QR (add/rename/retire without a deploy).
test.describe('Settings — Payment Methods', () => {
  test('shows the seeded option lists for Card, Bank Transfer, and QR', async ({ page }) => {
    await gotoReady(page, '/settings/payment-methods')
    await expect(page.getByRole('heading', { name: 'Payment Methods' })).toBeVisible({
      timeout: 10_000,
    })

    const cardSection = page.getByTestId('payment-method-options-card')
    await expect(cardSection.getByText('BDO', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(cardSection.getByText('BPI', { exact: true })).toBeVisible()
    await expect(cardSection.getByText('Metrobank', { exact: true })).toBeVisible()
    await expect(cardSection.getByText('Maya', { exact: true })).toBeVisible()

    const qrSection = page.getByTestId('payment-method-options-qr')
    await expect(qrSection.getByText('Palawan', { exact: true })).toBeVisible()
    await expect(qrSection.getByText('GCash Soundpay', { exact: true })).toBeVisible()
    await expect(qrSection.getByText('ECPay', { exact: true })).toBeVisible()
    await expect(qrSection.getByText('Maya QR', { exact: true })).toBeVisible()
    await expect(qrSection.getByText('Security Bank (SCB) QR', { exact: true })).toBeVisible()
  })

  test('adds, toggles, and deletes an option under QR', async ({ page }) => {
    await gotoReady(page, '/settings/payment-methods')
    const qrSection = page.getByTestId('payment-method-options-qr')

    const name = `E2E Gateway ${Date.now()}`
    // fillStable's retry loop only returns once the typed value survives a
    // check — i.e. hydration has already settled — so the plain click right
    // after isn't racing an unattached handler (same reasoning the
    // inventory-price-use-types.spec.ts create flow relies on).
    await fillStable(qrSection.getByPlaceholder('e.g. BDO'), name)
    await qrSection.getByRole('button', { name: 'Add' }).click()
    await expect(qrSection.getByText(name)).toBeVisible({ timeout: 10_000 })

    const row = qrSection.locator('[data-testid^="payment-method-option-row-"]', {
      hasText: name,
    })
    const toggle = row.getByRole('switch')
    await expect(toggle).toHaveAttribute('aria-checked', 'true')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false', { timeout: 10_000 })

    await row.getByRole('button', { name: 'Delete' }).click()
    await expect(qrSection.getByText(name)).toHaveCount(0, { timeout: 10_000 })
  })
})
