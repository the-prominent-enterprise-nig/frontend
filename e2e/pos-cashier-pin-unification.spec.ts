import { test, expect, type Page } from '@playwright/test'
import { gotoReady, fillAllStable, clickStable } from './utils'

// Part 5 of docs/pos-configuration-consolidation-plan.md (Step 7) originally
// unified /pos/pin and My Workspace > Configuration > POS PIN behind one
// shared CashierPinManager component. Configuration was later removed
// entirely (its Payment Methods/Receipt Branding tabs migrated into POS
// Settings — see pos-config-migration.spec.ts), so /pos/pin is now the only
// entry point. This still verifies its full set/view/change flow.

const VIEW_MARKER = 'Your PIN is active and ready for POS approvals.'
const SET_MARKER = "You don't have a PIN yet. Create one to enable POS approvals."

// PinInput's <label> isn't associated with its <input> via htmlFor/id (kept
// as-is per the plan doc rather than modified for this part), so getByLabel
// won't resolve it — locate the input via its label's following sibling.
function pinInput(page: Page, label: string) {
  return page.locator(
    `xpath=//label[normalize-space(text())="${label}"]/following-sibling::div[1]//input`
  )
}

test.describe('POS PIN — full set/view/change flow (Part 5)', () => {
  test('Business Owner: /pos/pin resolves to the right mode and exposes the change flow', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/pin')
    await expect(page.getByRole('heading', { name: 'POS PIN' })).toBeVisible()

    const alreadyHasPin = await page
      .getByText(VIEW_MARKER)
      .isVisible()
      .catch(() => false)

    if (!alreadyHasPin) {
      await expect(page.getByText(SET_MARKER)).toBeVisible()
      await fillAllStable([
        { locator: pinInput(page, 'New PIN'), value: '135790' },
        { locator: pinInput(page, 'Confirm PIN'), value: '135790' },
      ])
      const setButton = page.getByRole('button', { name: 'Set PIN' })
      await clickStable(setButton, page.getByText(VIEW_MARKER))
    }

    await expect(page.getByText(VIEW_MARKER)).toBeVisible()

    await page.getByRole('button', { name: 'Change', exact: true }).click()
    await expect(pinInput(page, 'Current PIN')).toBeVisible()
    await expect(pinInput(page, 'New PIN')).toBeVisible()
    await expect(pinInput(page, 'Confirm New PIN')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Forgot PIN?' })).toBeVisible()
  })
})

test.describe('POS PIN — Cashier access (Part 5)', () => {
  // Overrides the chromium project's default Business Owner storageState —
  // same pattern as pos-loyalty-split.spec.ts's Cashier test.
  test.use({ storageState: { cookies: [], origins: [] } })

  test('Cashier can still reach /pos/pin directly with no 403', async ({ page }) => {
    await gotoReady(page, '/login')
    await expect(async () => {
      await fillAllStable([
        { locator: page.locator('#email'), value: 'technova.b1.cashier@test.com' },
        { locator: page.locator('#password'), value: 'dev-prominent-enterprise-2026' },
      ])
      await page.click('button[type="submit"]')
      await expect(page).not.toHaveURL(/\/login$/, { timeout: 8_000 })
    }).toPass({ timeout: 30_000 })

    await gotoReady(page, '/pos/pin')
    await expect(page.getByRole('heading', { name: 'POS PIN' })).toBeVisible()
    await expect(page).not.toHaveURL(/\/403$/)
  })
})
