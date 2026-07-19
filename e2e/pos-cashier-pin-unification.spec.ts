import { test, expect, type Page } from '@playwright/test'
import { gotoReady, fillAllStable, clickStable } from './utils'

// Part 5 of docs/pos-configuration-consolidation-plan.md (Step 7): /pos/pin
// and My Workspace > Configuration > POS PIN now both render the same shared
// CashierPinManager component (4 modes: set/view/change/reset), instead of
// two separately-maintained implementations — and both reflect the same
// underlying PIN state since they read from the same backend endpoint.

// ViewPinCard vs SetPinCard have unique subtitle text — safer to match on
// than "POS PIN", which also appears as the Configuration page's own tab
// button label.
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

test.describe('POS PIN — shared component, both entry points (Part 5)', () => {
  test('Business Owner: /pos/pin and Configuration POS PIN tab show the same 4-mode UI and the same underlying state', async ({
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

    // Now /pos/pin is in "view" mode. Visit the other entry point and
    // confirm it independently resolves to the same state — proving both
    // read from the same getCashierPinStatus() call, not separate state.
    await gotoReady(page, '/settings/configuration')
    await page.getByRole('button', { name: 'POS PIN' }).click()
    await expect(page.getByText(VIEW_MARKER)).toBeVisible()

    // Both entry points expose the same change/reset flow from here.
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
