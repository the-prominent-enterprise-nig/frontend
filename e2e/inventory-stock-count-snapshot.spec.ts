import { test, expect } from '@playwright/test'
import { gotoReady, loginAs, clickStable } from './utils'

// Scenario 19 Part 1 — server-snapshotted expected quantity. Before this
// change, the Count Sheet let the operator freely type both "Expected" and
// "Counted" values client-side, so the variance was never provably against a
// real system baseline. Now "Expected" is read-only (server-derived at count
// start), and a new line is added via a dedicated "Add item not listed
// above" control that resolves expectedQty server-side instead of accepting
// client input. Opts out of the shared Business Owner storageState like the
// sibling stock-adjustment spec, since it exercises the Stock Controller
// role that actually owns this flow.
test.use({ storageState: { cookies: [], origins: [] } })

const STOCK_CONTROLLER_EMAIL = process.env.E2E_STOCK_EMAIL ?? 'technova.b1.stock@test.com'
const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'

test.describe('Inventory — Stock Count server-side snapshot (Scenario 19 Part 1)', () => {
  test('Expected quantity is read-only and a new line resolves expectedQty server-side', async ({
    page,
  }) => {
    await loginAs(page, STOCK_CONTROLLER_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/stock-counts')

    // A branch-scoped Stock Controller now only sees their own branch's
    // warehouse, which the modal auto-fills (no <select> at all) — wait for
    // the modal via a control that's always present regardless.
    const createSessionButton = page.getByRole('button', { name: 'Create Session' })
    await clickStable(page.getByRole('button', { name: 'New Count' }), createSessionButton)
    // The warehouse field briefly renders as a <select> before the
    // warehouses query resolves into its final auto-fill-or-not state, then
    // swaps out from under an in-flight interaction — bounded settle before
    // touching it.
    await page.waitForTimeout(500)
    const warehouseSelect = page
      .locator('select')
      .filter({ has: page.locator('option', { hasText: 'Select warehouse' }) })
    if (await warehouseSelect.isVisible().catch(() => false)) {
      // Prefer one of the dedicated E2E-isolated warehouses other specs use
      // (only relevant for a multi-warehouse account, e.g. Business Owner)
      // — general-catalog warehouses (Manila/Cebu/Davao) accumulate
      // balances across every run of every count-related spec and can
      // eventually cover the whole catalog, leaving nothing for "Add item
      // not listed above" to offer. An isolated warehouse is far less
      // likely to already carry a balance for an arbitrary catalog item.
      const warehouseOptions = await warehouseSelect.locator('option').allTextContents()
      const isolatedIndex = warehouseOptions.findIndex((t) => t.includes('Isolated Warehouse'))
      await warehouseSelect.selectOption({ index: isolatedIndex >= 0 ? isolatedIndex : 1 })
    }

    await expect(async () => {
      await page.getByRole('button', { name: 'Create Session' }).click()
      await expect(page.getByText('Count session created').first()).toBeVisible({
        timeout: 3_000,
      })
    }).toPass({ timeout: 15_000 })

    // Scope subsequent actions to this session's own row (by its permanent
    // short ID), not by list position — the shared dev database accumulates
    // sessions across runs.
    const freshRow = page.locator('tr').filter({ hasText: 'Scheduled' })
    const sessionId = await freshRow.locator('td').first().innerText()
    const ownRow = page.locator('tr').filter({ hasText: sessionId })

    const sessionHeading = page.getByRole('heading', { name: 'Count Session' })
    await clickStable(ownRow.getByRole('button', { name: 'Open' }), sessionHeading)

    await expect(async () => {
      await page.getByRole('button', { name: 'Start Count' }).click()
      await expect(page.getByText('Count started').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })

    // Regression guard: the open modal must reflect 'in_progress' right away
    // — no manual close/reopen should be required to see the Count Sheet.
    // (Previously selectedCount was a stale snapshot from before start()
    // landed, so this needed a close+reopen dance to pick up the fresh
    // status; useStockCounts' startMutation now patches selectedCount
    // directly from the mutation response.)
    const addItemSelect = page
      .locator('select')
      .filter({ has: page.locator('option', { hasText: 'Add item not listed above' }) })
    await expect(addItemSelect).toBeVisible({ timeout: 5_000 })

    // The old free-typed "Expected" input must be gone entirely — expected
    // quantity is now always server-rendered text, never an editable field.
    await expect(page.locator('input[placeholder="Expected"]')).toHaveCount(0)

    // The shared dev database already has many pre-existing count lines in
    // most warehouses, so `.last()` on the "Counted" input is visible before
    // Add is even clicked — wait for the row count to actually increase
    // instead, then read whatever expectedQty the server resolved for the
    // newly-added item (never assume it's 0). The Add dropdown/button render
    // regardless of the lines query's own loading state, so wait for that to
    // settle (rows present, or the explicit "no balances" empty state) before
    // capturing the baseline count.
    const rowLocator = page.locator('div.grid.grid-cols-12.gap-2.items-center')
    await expect(async () => {
      const loaded =
        (await rowLocator.count()) > 0 ||
        (await page
          .getByText('No existing balances')
          .isVisible()
          .catch(() => false))
      expect(loaded).toBe(true)
    }).toPass({ timeout: 10_000 })
    const rowCountBefore = await rowLocator.count()

    // Only exercise the "add a new line" path if this warehouse actually has
    // an item left to add — after enough repeated runs (of this spec or any
    // other count spec) a warehouse's catalog coverage can become saturated
    // (every item already has a balance/line), leaving nothing but the
    // placeholder option. That's still a legitimate live-data state, not a
    // bug: fall back to exercising the read-only/variance assertions against
    // an existing pre-populated row instead. The "add resolves expectedQty
    // server-side" behavior itself is covered unconditionally by the backend
    // e2e suite (inventory-stock-count-snapshot.e2e-spec.ts) against
    // dedicated, isolated test items.
    const addableOptionCount = await addItemSelect.locator('option').count()
    if (addableOptionCount > 1) {
      await addItemSelect.selectOption({ index: 1 })
      await expect(async () => {
        await page.getByRole('button', { name: 'Add' }).click()
        await expect(rowLocator).toHaveCount(rowCountBefore + 1, { timeout: 3_000 })
      }).toPass({ timeout: 15_000 })
    }

    const targetRow = rowLocator.last()
    const expectedQty = Number(await targetRow.locator('p').nth(2).innerText())
    const countedInput = targetRow.locator('input[placeholder="Counted"]')

    await countedInput.fill(String(expectedQty + 5))
    await expect(targetRow.getByText('+5', { exact: true })).toBeVisible({ timeout: 5_000 })

    await expect(async () => {
      await page.getByRole('button', { name: 'Submit Count' }).click()
      await expect(page.getByText('Count submitted').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })
  })
})
