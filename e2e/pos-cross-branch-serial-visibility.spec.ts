import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Scenario 04, Parts 1-3 — POS cross-branch serial visibility + one-tap
// request. Refrigerator
// is seeded with 200 in-stock serials in EVERY branch's warehouse specifically
// so this never runs low (see prisma/seed.ts "Variant item serials") — real
// multi-branch stock, not a mocked/isolated fixture, which is exactly what's
// needed to actually exercise the "Also Available Elsewhere" grouping.
//
// Defers to checkout's own session-state handling (No Open Session prompt /
// multi-session dropdown / single auto-selected session) rather than
// re-parsing the sessions table, since checkout already resolves that
// unambiguously. Matches the item by its exact display name ("Refrigerator")
// rather than SKU, since "Refrigerator Deodorizer" also matches a substring
// search and SKU prefixes can drift between seed runs.
//
// FIXED, 2026-08-14: this file previously hardcoded the old placeholder
// branch/warehouse names (Manila HQ / Cebu Office / Davao Branch), which no
// longer exist — real NIG branch names replaced them session-wide. Renamed
// per docs/seed-data-reference.md: Bago (was "Manila HQ", b1), Binalbagan
// (was "Cebu Office", b2), Candoni (was "Davao Branch", b3). Terminal codes
// (TN-B1-01/TN-B2-01/TN-B3-01) and warehouse codes (WH-01/WH-02/WH-03) are
// unchanged — only the branch display-name strings were ever fake. Cashier
// name "Tyrell Buckridge" was left untouched (out of scope for this rename:
// it's a person, not a branch name) — but per the current seed reference
// table this name is now the Branch Manager for Binalbagan (b2), not a
// Bago (b1) cashier, so if opening a Bago session with this cashier stops
// working, that's a separate pre-existing data mismatch to check.
async function openBagoSession(page: import('@playwright/test').Page) {
  await gotoReady(page, '/pos/sessions')
  await clickStable(
    page.getByRole('button', { name: 'Open Session' }),
    page.getByRole('heading', { name: 'Open Session' })
  )

  // Business Owner opening a session auto-fills themselves as the cashier —
  // switch to a real Bago-branch cashier so the session lands on Bago's
  // roster the same way a normal shift-open would.
  const notYou = page.getByText('Not you?')
  if (await notYou.isVisible().catch(() => false)) {
    await notYou.click()
  }
  await page.getByPlaceholder('Type to search…').fill('Tyrell Buckridge')
  await page.getByText('Tyrell Buckridge', { exact: true }).first().click()

  await page.getByPlaceholder('4–6 digit PIN').fill('1234')
  await page.getByRole('button', { name: 'Verify PIN' }).click()
  // Verified state swaps the PIN field for a green checkmark row.
  await expect(page.getByText('Tyrell Buckridge', { exact: true })).toBeVisible({
    timeout: 10_000,
  })

  const terminalSelect = page.locator('select')
  const bagoOption = terminalSelect.locator('option', { hasText: 'TN-B1-01' })
  const bagoLabel = (await bagoOption.textContent())?.trim() ?? ''
  expect(bagoLabel).toContain('TN-B1-01')
  // Same hydration race fillStable/clickStable guard against elsewhere in
  // this suite — retry the select until the value actually sticks.
  await expect(async () => {
    await terminalSelect.selectOption({ label: bagoLabel })
    await expect(terminalSelect).toHaveValue(/.+/)
  }).toPass({ timeout: 10_000 })

  await page.getByRole('spinbutton').fill('1000')

  await expect(async () => {
    await page.getByRole('button', { name: 'Open Session' }).click()
    await expect(page.getByRole('heading', { name: 'Open Session' })).toHaveCount(0, {
      timeout: 3_000,
    })
  }).toPass({ timeout: 15_000 })
}

test.describe('POS Checkout — Cross-Branch Serial Visibility', () => {
  test('serial picker splits into In This Branch and Also Available Elsewhere, and a one-tap Request raises a transfer', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/checkout')

    const noSessionLink = page.getByRole('link', { name: 'Open a Session' })
    if (await noSessionLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await openBagoSession(page)
      await gotoReady(page, '/pos/checkout')
    }

    // Multiple open sessions render a <select> in the top bar — explicitly
    // pick Bago rather than relying on whatever sorts first. Scoped to
    // the select that actually CONTAINS a TN-B1-01 option (there's also an
    // unrelated branch-context combobox elsewhere on the page that a bare
    // getByRole('combobox').first() can accidentally match instead).
    // isVisible() checks the CURRENT state with no retry — the sessions
    // query hasn't necessarily resolved yet right after navigation, so wait
    // for it properly (and accept that it may legitimately never appear, if
    // there's only one open session and it auto-selected).
    const sessionSelect = page
      .locator('select')
      .filter({ has: page.locator('option', { hasText: 'TN-B1-01' }) })
    const sessionSelectAppeared = await sessionSelect
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false)
    if (sessionSelectAppeared) {
      const bagoOption = sessionSelect.locator('option', { hasText: 'TN-B1-01' })
      const value = await bagoOption.getAttribute('value')
      if (value) {
        // Same hydration race fillStable/clickStable guard against elsewhere
        // in this suite — retry the select until the value actually sticks.
        await expect(async () => {
          await sessionSelect.selectOption(value)
          await expect(sessionSelect).toHaveValue(value)
        }).toPass({ timeout: 10_000 })
      }
    }

    const searchInput = page.getByPlaceholder('Search by name or serial')
    await expect(searchInput).toBeVisible({ timeout: 15_000 })
    await searchInput.fill('Refrigerator')

    const refrigeratorCard = page
      .getByRole('button')
      .filter({ has: page.getByText('Refrigerator', { exact: true }) })
    await expect(refrigeratorCard.first()).toBeVisible({ timeout: 10_000 })
    await refrigeratorCard.first().click()

    await expect(page.getByRole('heading', { name: 'Select Serial Number' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('Also available elsewhere', { exact: true })).toBeVisible({
      timeout: 10_000,
    })

    // In This Branch — Bago's own serials (WH-01).
    await expect(page.getByText('In this branch', { exact: true })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText(/WH-01/).first()).toBeVisible()

    // Also Available Elsewhere — a per-branch count summary by default
    // (collapsed, so this section never needs its own scroll). Regression
    // guard: must never list the caller's own branch under "elsewhere" —
    // that was a real bug (own-branch dedup only matched serials already
    // present in a separate, possibly-truncated fetch).
    await expect(page.getByText('Also available elsewhere', { exact: true })).toBeVisible()
    await expect(page.getByText('Bago Warehouse', { exact: true })).toHaveCount(0)
    const binalbaganToggle = page.getByRole('button', { name: /Binalbagan Warehouse/ })
    const candoniToggle = page.getByRole('button', { name: /Candoni Warehouse/ })
    await expect(binalbaganToggle).toBeVisible()
    await expect(candoniToggle).toBeVisible()
    await expect(binalbaganToggle).toContainText(/in stock/)
    await expect(candoniToggle).toContainText(/in stock/)

    // Side panel closed by default — no individual serials shown yet.
    await expect(page.getByText(/WH-02-BULK/)).toHaveCount(0)
    await expect(page.getByText(/WH-03-BULK/)).toHaveCount(0)

    // Part 3 — open the side panel to pick a specific unit, then request it.
    // Raises a real stock transfer via POST /inventory/transfers/request-from-pos;
    // not cleaned up afterward (local-only check) — a repeat run just
    // requests a different (or the same) Binalbagan serial again.
    await binalbaganToggle.click()
    await expect(page.getByText(/WH-02-BULK/).first()).toBeVisible({ timeout: 10_000 })
    // Only one branch's panel shows at a time — Candoni's serials stay hidden.
    await expect(page.getByText(/WH-03-BULK/)).toHaveCount(0)

    const firstRequestButton = page.getByRole('button', { name: /Request/ }).first()
    await firstRequestButton.click()
    await expect(page.getByText('Requested', { exact: true })).toBeVisible({ timeout: 10_000 })

    // Switching to Candoni replaces the panel — Binalbagan's serials disappear, Candoni's show.
    await candoniToggle.click()
    await expect(page.getByText(/WH-03-BULK/).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/WH-02-BULK/)).toHaveCount(0)

    // Close without picking a serial — cart state is ephemeral client-side
    // state, nothing to clean up server-side.
    await page.getByRole('button', { name: 'Close' }).click()
  })
})
