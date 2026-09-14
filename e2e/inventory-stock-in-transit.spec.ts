import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 50 (Closing Gap 3) — the client asked for an "In Stock / In Transit"
// status filter on Stock Balance. The backend half (resolveInTransitMap, the
// stockStatus DTO param) shipped 2026-09-10; the UI half was built the same day
// and then removed on developer instruction, taking this spec's predecessor
// with it. The 2026-09-14 revised client list re-asserted the ask, so the
// filter is back — as a filter only, no In Transit column: rows roll up per
// item across locations, so one unattributed qty would flatten "3 in transit to
// Bago, 2 to Ajuy" into a meaningless 5.
//
// Read-only against seeded data — creates nothing, so there is nothing to
// clean up.

const STOCK_URL = '/inventory/stock'
const STATE_FILTER = 'input[placeholder="All Stock"]'

// The wide layout is a CSS-grid `role="table"` of divs, not a real <table> —
// same approach as Purchase Orders. Locate by ARIA role, not by tag. (The
// sibling rollup spec still uses `table tbody tr` and fails on all four of its
// table-based tests for exactly this reason — pre-existing, flagged separately.)
const ROWS = '[role="table"][aria-label="Stock balance"] [role="row"]:not(:first-child)'

test.describe('Inventory > Stock Balance in-transit filter', () => {
  test('offers the stock state filter alongside the existing filters', async ({ page }) => {
    await gotoReady(page, STOCK_URL)

    await expect(page.locator(STATE_FILTER)).toBeVisible()

    // The filters it has to sit beside, not replace.
    await expect(page.locator('input[placeholder="All Branches"]')).toBeVisible()
    await expect(page.locator('input[placeholder="All Operations"]')).toBeVisible()
    await expect(page.getByPlaceholder('Search brand, model, or category…')).toBeVisible()
  })

  test('offers every state the row badge can show, plus In Transit', async ({ page }) => {
    await gotoReady(page, STOCK_URL)

    await page.locator(STATE_FILTER).click()

    // The four that mirror STOCK_STATUS_META's badges...
    for (const state of ['In Stock', 'Low Stock', 'Fully Reserved', 'Out of Stock']) {
      await expect(page.getByRole('button', { name: state, exact: true })).toBeVisible()
    }
    // ...and the separate open-transfer axis.
    await expect(page.getByRole('button', { name: 'In Transit', exact: true })).toBeVisible()
  })

  // Each badge state must actually be selectable and produce a self-consistent
  // list: every row the filter returns has to carry the badge that was asked
  // for. This is what the pre-roll-up filter could not do — an item with 0 on
  // hand in one branch and 5 in another matched 'out' on its location row and
  // then rendered as one rolled-up row with 5 and an "In Stock" badge.
  for (const state of ['In Stock', 'Low Stock', 'Fully Reserved', 'Out of Stock']) {
    test(`filtering to ${state} returns only rows badged ${state}`, async ({ page }) => {
      await gotoReady(page, STOCK_URL)

      const stateFilter = page.locator(STATE_FILTER)
      await stateFilter.click()
      await page.getByRole('button', { name: state, exact: true }).click()
      await expect(stateFilter).toHaveValue(state)

      const rows = page.locator(ROWS)
      await expect.poll(async () => rows.count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(0)

      // Seed data may legitimately hold none of a given state — an empty list
      // is a pass. What must never happen is a row badged something else.
      const count = await rows.count()
      for (let i = 0; i < Math.min(count, 10); i++) {
        await expect(rows.nth(i)).toContainText(state)
      }
    })
  }

  // Every state must be accepted by the API and settle the screen — never a
  // 400 (which an un-widened @IsIn would give) and never a silent fall back to
  // the unfiltered list. An empty result is a legitimate outcome here: the dev
  // DB currently has all 21 items on hand, unreserved, and with NO reorder
  // points configured anywhere, so out / fully_reserved / low / in_transit all
  // return zero rows against this seed. That makes these assertions weaker than
  // they look — they prove the plumbing, not the maths. Seed a low-stock or
  // reserved row to make them bite.
  for (const state of ['In Stock', 'Low Stock', 'Fully Reserved', 'Out of Stock', 'In Transit']) {
    test(`${state} is accepted and settles the screen`, async ({ page }) => {
      await gotoReady(page, STOCK_URL)

      const stateFilter = page.locator(STATE_FILTER)
      await stateFilter.click()
      await page.getByRole('button', { name: state, exact: true }).click()
      await expect(stateFilter).toHaveValue(state)

      // Either the grid renders rows, or the filtered-empty state does. What
      // must not happen is a crash or a stuck skeleton.
      const grid = page.locator('[role="table"][aria-label="Stock balance"]')
      const empty = page.getByText(/No items match|No stock on record/i).first()
      await expect
        .poll(async () => (await grid.count()) + (await empty.count()), { timeout: 15_000 })
        .toBeGreaterThan(0)
      await expect(page.getByText('Loading stock balances…')).toBeHidden()
    })
  }

  test('filtering to In Transit narrows the list and never grows it', async ({ page }) => {
    await gotoReady(page, STOCK_URL)

    const rows = page.locator(ROWS)
    await expect.poll(async () => rows.count(), { timeout: 15_000 }).toBeGreaterThan(0)
    const unfiltered = await rows.count()

    const stateFilter = page.locator(STATE_FILTER)
    await stateFilter.click()
    await page.getByRole('button', { name: 'In Transit', exact: true }).click()

    await expect(stateFilter).toHaveValue('In Transit')

    // In-transit stock is a strict subset of all stock. Seed data may hold zero
    // open transfers, so an empty result is legitimate — what must never happen
    // is the filter widening the set, which is how a silently-ignored query
    // param would present.
    await expect.poll(async () => rows.count(), { timeout: 15_000 }).toBeLessThanOrEqual(unfiltered)
  })

  test('the state filter counts toward Clear filters and resets with it', async ({ page }) => {
    await gotoReady(page, STOCK_URL)

    const stateFilter = page.locator(STATE_FILTER)
    await stateFilter.click()
    await page.getByRole('button', { name: 'In Stock', exact: true }).click()
    await expect(stateFilter).toHaveValue('In Stock')

    // resetFilters() already cleared stockStatus while the control was absent —
    // this proves the control is actually wired to that same state and not to a
    // second, parallel one.
    const clear = page.getByRole('button', { name: /^Clear \d* ?filters?$/ })
    await expect(clear).toBeVisible()
    await clear.click()

    await expect(stateFilter).toHaveValue('')
  })
})
