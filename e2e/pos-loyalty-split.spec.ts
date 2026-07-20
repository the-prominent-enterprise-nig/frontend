import { test, expect } from '@playwright/test'
import { gotoReady, fillAllStable, fillStable, clickStable } from './utils'

// Part 4 of docs/pos-configuration-consolidation-plan.md (Step 6): /pos/loyalty
// splits into an always-reachable customer lookup tool plus a "Loyalty
// Program" settings card that only renders for Business Owner / Branch
// Manager (canManagePosSettings) — the lookup half stays open to every POS
// role with no guard, unchanged from before this part.

test.describe('POS Loyalty — Business Owner sees settings + lookup (Part 4)', () => {
  test('Loyalty Program card is visible, lookup still works, and saving round-trips through a reload', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/loyalty')
    await expect(page.getByRole('heading', { name: 'Look Up Customer Balance' })).toBeVisible()

    // Lookup half is untouched by this part.
    await expect(page.getByText('Customer Lookup', { exact: true })).toBeVisible()

    // Settings half — Business Owner can manage.
    await expect(page.getByRole('heading', { name: 'Loyalty Program' })).toBeVisible()

    await fillAllStable([
      { locator: page.locator('#loyalty-points-per-unit'), value: '2' },
      { locator: page.locator('#loyalty-points-value'), value: '0.5' },
      { locator: page.locator('#loyalty-max-redeem-pct'), value: '30' },
      { locator: page.locator('#loyalty-minimum-redeem'), value: '100' },
    ])

    // Force the toggle to a known "on" state regardless of its starting value.
    const toggle = page.getByRole('switch', { name: 'Active' })
    if ((await toggle.getAttribute('aria-checked')) !== 'true') {
      await toggle.click()
    }
    await expect(toggle).toHaveAttribute('aria-checked', 'true')

    // Button reads "Create" the first time a tenant configures this, "Save
    // Changes" on every save after — either is a valid starting state here.
    const saveButton = page.getByRole('button', { name: /^(Create|Save Changes)$/ })
    await clickStable(saveButton, page.getByText('Loyalty program saved.'))

    // Reload from scratch and confirm the values actually persisted
    // server-side via a fresh getLoyaltyProgram fetch, not just local state.
    await gotoReady(page, '/pos/loyalty')
    await expect(page.locator('#loyalty-points-per-unit')).toHaveValue(/^2(\.0+)?$/)
    await expect(page.locator('#loyalty-points-value')).toHaveValue(/^0\.5(0+)?$/)
    await expect(page.locator('#loyalty-max-redeem-pct')).toHaveValue('30')
    await expect(page.locator('#loyalty-minimum-redeem')).toHaveValue('100')
    await expect(page.getByRole('switch', { name: 'Active' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    // A program now exists, so the button must read "Save Changes", not "Create".
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible()
  })

  test('Customer Lookup searches by name/phone/customer code instead of requiring a raw ID', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/loyalty')

    const searchInput = page.getByPlaceholder('Search by name, phone, or customer code…')
    const results = page.getByRole('region', { name: 'Customer search results' })

    // No-results path. Re-fill on every retry, not just once: a late
    // hydration reconciliation can wipe the field after fillStable's own
    // check passes but before the debounced search actually fires (the same
    // race fillAllStable's docstring describes for multi-field forms — here
    // there's only one field, so the fill itself has to be inside the retry).
    await expect(async () => {
      await fillStable(searchInput, 'zzz-no-such-customer-zzz')
      await expect(results.getByText('No customers found')).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 20_000 })

    // customerCode is one of the fields the backend search matches on
    // (alongside name/phone/email) — searching a real seeded code prefix
    // finds real customers without needing their raw internal ID.
    await expect(async () => {
      await fillStable(searchInput, 'TN-AR-00')
      await expect(results.locator('button').first()).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 20_000 })

    // Selecting a result runs the same lookup as before, just keyed off the
    // customer's real id instead of a typed-in one. None of the base seed
    // customers have a loyalty account yet, so the backend's 404 is the
    // expected, correctly-surfaced outcome here — this still proves the
    // search-to-lookup wiring works end to end.
    await results.locator('button').first().click()
    await expect(page.getByText(/No loyalty account found for customer/)).toBeVisible()
  })
})

test.describe('POS Loyalty — Cashier sees lookup only (Part 4)', () => {
  // Every other spec in this repo runs as the pre-authenticated Business
  // Owner (chromium project's default storageState). This is the first test
  // needing a genuinely lower-privileged role, so it clears that default and
  // logs in fresh as a seeded Cashier instead of adding a new persisted
  // storage-state file for a single test.
  test.use({ storageState: { cookies: [], origins: [] } })

  test('Cashier can use the lookup tool but never sees the Loyalty Program settings card', async ({
    page,
  }) => {
    await gotoReady(page, '/login')
    // Re-fill on every retry, not just once before the loop: under dev-server
    // load, a hydration reconciliation can wipe the fields *after*
    // fillAllStable confirms them but *before* this submits, leaving every
    // later retry submitting an empty form forever. Re-filling each attempt
    // means a wipe just costs one extra retry instead of hanging the loop.
    // Unlike the Business Owner (redirects to '/'), a Cashier's post-login
    // landing page depends on their module access (e.g. '/inventory') — just
    // confirm login succeeded and navigate to the page under test directly.
    await expect(async () => {
      await fillAllStable([
        { locator: page.locator('#email'), value: 'technova.b1.cashier@test.com' },
        { locator: page.locator('#password'), value: 'dev-prominent-enterprise-2026' },
      ])
      await page.click('button[type="submit"]')
      await expect(page).not.toHaveURL(/\/login$/, { timeout: 8_000 })
    }).toPass({ timeout: 30_000 })

    await gotoReady(page, '/pos/loyalty')
    await expect(page.getByRole('heading', { name: 'Look Up Customer Balance' })).toBeVisible()
    await expect(page.getByText('Customer Lookup', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Loyalty Program' })).toHaveCount(0)
  })
})
