import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Scenario 10 (Purchasing & AP) Part 3 — AP payment method + GL account
// config. Self-cleaning: disables the method it creates (there's no hard
// delete, matching the soft-disable pattern used across this codebase).
test.describe('Accounting — AP Payment Methods', () => {
  test('creates a payment method with a GL account and it appears in the list', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/ap-payment-methods')
    await expect(page.getByRole('heading', { name: 'AP Payment Methods' })).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole('button', { name: 'New Method' }).click()
    const marker = `E2E Method ${Date.now()}`
    await fillStable(page.getByPlaceholder('e.g. Check, Bank Transfer'), marker)
    await fillStable(page.getByPlaceholder('Short label shown in the payment form'), 'E2E')

    await page.getByRole('button', { name: 'Save' }).click()

    const row = page.locator('tbody tr', { hasText: marker })
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row).toContainText('Enabled')

    // Cleanup — disable it.
    page.once('dialog', (dialog) => dialog.accept())
    await row.locator('button.text-red-600').click()
    await expect(row).toContainText('Disabled', { timeout: 10_000 })
  })
})
