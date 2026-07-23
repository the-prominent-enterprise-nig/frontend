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
async function openManilaSession(page: import('@playwright/test').Page) {
  await gotoReady(page, '/pos/sessions')
  await clickStable(
    page.getByRole('button', { name: 'Open Session' }),
    page.getByRole('heading', { name: 'Open Session' })
  )

  // Business Owner opening a session auto-fills themselves as the cashier —
  // switch to a real Manila-branch cashier so the session lands on Manila's
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
  const manilaOption = terminalSelect.locator('option', { hasText: 'TN-B1-01' })
  const manilaLabel = (await manilaOption.textContent())?.trim() ?? ''
  expect(manilaLabel).toContain('TN-B1-01')
  // Same hydration race fillStable/clickStable guard against elsewhere in
  // this suite — retry the select until the value actually sticks.
  await expect(async () => {
    await terminalSelect.selectOption({ label: manilaLabel })
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
      await openManilaSession(page)
      await gotoReady(page, '/pos/checkout')
    }

    // Multiple open sessions render a <select> in the top bar — explicitly
    // pick Manila HQ rather than relying on whatever sorts first. Scoped to
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
      const manilaOption = sessionSelect.locator('option', { hasText: 'TN-B1-01' })
      const value = await manilaOption.getAttribute('value')
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

    // In This Branch — Manila's own serials (WH-01).
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
    await expect(page.getByText('Manila HQ Warehouse', { exact: true })).toHaveCount(0)
    const cebuToggle = page.getByRole('button', { name: /Cebu Office Warehouse/ })
    const davaoToggle = page.getByRole('button', { name: /Davao Branch Warehouse/ })
    await expect(cebuToggle).toBeVisible()
    await expect(davaoToggle).toBeVisible()
    await expect(cebuToggle).toContainText(/in stock/)
    await expect(davaoToggle).toContainText(/in stock/)

    // Side panel closed by default — no individual serials shown yet.
    await expect(page.getByText(/WH-02-BULK/)).toHaveCount(0)
    await expect(page.getByText(/WH-03-BULK/)).toHaveCount(0)

    // Part 3 — open the side panel to pick a specific unit, then request it.
    // Raises a real stock transfer via POST /inventory/transfers/request-from-pos;
    // not cleaned up afterward (local-only check) — a repeat run just
    // requests a different (or the same) Cebu serial again.
    await cebuToggle.click()
    await expect(page.getByText(/WH-02-BULK/).first()).toBeVisible({ timeout: 10_000 })
    // Only one branch's panel shows at a time — Davao's serials stay hidden.
    await expect(page.getByText(/WH-03-BULK/)).toHaveCount(0)

    const firstRequestButton = page.getByRole('button', { name: /Request/ }).first()
    await firstRequestButton.click()
    await expect(page.getByText('Requested', { exact: true })).toBeVisible({ timeout: 10_000 })

    // Switching to Davao replaces the panel — Cebu's serials disappear, Davao's show.
    await davaoToggle.click()
    await expect(page.getByText(/WH-03-BULK/).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/WH-02-BULK/)).toHaveCount(0)

    // Close without picking a serial — cart state is ephemeral client-side
    // state, nothing to clean up server-side.
    await page.getByRole('button', { name: 'Close' }).click()
  })
})
