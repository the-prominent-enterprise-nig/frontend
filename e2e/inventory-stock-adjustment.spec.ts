import { test, expect } from '@playwright/test'
import { gotoReady, loginAs, clickStable } from './utils'

// INV-64 — "record stock adjustments with reason codes". Ticket was marked
// "for qa" but the Create Adjustment tab had no line-item UI (submission
// always failed client validation) and was gated on the wrong permission
// (inventory:stock-count:adjust instead of the endpoint's actual
// inventory:stock:adjust), so the Stock Controller role got 403'd even once
// the form could be filled in. Both are fixed; this spec exercises the real
// role boundary, not just the UI, so it opts out of the shared Business Owner
// storageState every other spec inherits.
test.use({ storageState: { cookies: [], origins: [] } })

const STOCK_CONTROLLER_EMAIL = process.env.E2E_STOCK_EMAIL ?? 'technova.b1.stock@test.com'
const CASHIER_EMAIL = process.env.E2E_CASHIER_EMAIL ?? 'technova.b1.cashier@test.com'
const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2025'

test.describe('Inventory — Stock Adjustments (INV-64)', () => {
  test('Stock Controller can post a stock adjustment with reason code and line items', async ({
    page,
  }) => {
    await loginAs(page, STOCK_CONTROLLER_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/stock-counts')

    const warehouseSelect = page
      .locator('select')
      .filter({ has: page.locator('option', { hasText: 'Select warehouse' }) })
    await clickStable(page.getByRole('button', { name: 'New Count' }), warehouseSelect)
    await warehouseSelect.selectOption({ index: 1 })

    await expect(async () => {
      await page.getByRole('button', { name: 'Create Session' }).click()
      await expect(page.getByText('Count session created').first()).toBeVisible({
        timeout: 3_000,
      })
    }).toPass({ timeout: 15_000 })

    // Scope every subsequent "Open" click to THIS session's own row (by its
    // permanent short ID), not by list position — the shared dev database
    // accumulates other sessions across runs (including ones this same spec
    // cancels rather than deletes, since there's no UI delete path), so
    // `.first()` on "Open" is not reliably this test's own row.
    const freshRow = page.locator('tr').filter({ hasText: 'Scheduled' })
    const sessionId = await freshRow.locator('td').first().innerText()
    const ownRow = page.locator('tr').filter({ hasText: sessionId })

    const sessionHeading = page.getByRole('heading', { name: 'Count Session' })
    await clickStable(ownRow.getByRole('button', { name: 'Open' }), sessionHeading)

    const startCountButton = page.getByRole('button', { name: 'Start Count' })
    if (await startCountButton.isVisible()) {
      await expect(async () => {
        await startCountButton.click()
        await expect(page.getByText('Count started').first()).toBeVisible({ timeout: 3_000 })
      }).toPass({ timeout: 15_000 })
    }

    // Starting the count invalidates the list query but the already-open
    // modal's `selectedCount` is a stale snapshot from before the mutation —
    // it doesn't always pick up the new "in_progress" status in place, so the
    // tab bar (gated on that status) can fail to appear. Closing and
    // reopening re-reads the now-fresh list. See also: verify report finding
    // filed against StockCountList/useStockCounts for the underlying bug.
    const adjustTabButton = page.getByRole('button', { name: 'Create Adjustment' })
    if (!(await adjustTabButton.isVisible().catch(() => false))) {
      await page
        .getByRole('button')
        .filter({ has: page.locator('svg.lucide-x') })
        .click()
      await expect(sessionHeading).toBeHidden({ timeout: 5_000 })
      await clickStable(ownRow.getByRole('button', { name: 'Open' }), sessionHeading)
    }
    await expect(adjustTabButton).toBeVisible({ timeout: 10_000 })
    await clickStable(adjustTabButton, page.getByRole('button', { name: 'Post Adjustment' }))

    const adjustForm = page.locator('form').last()
    await adjustForm.locator('textarea').fill('E2E: recount variance from automated test.')

    // Submitting with zero lines must still be blocked client-side — this is
    // the exact bug INV-64 shipped with (the array was always empty).
    const lineRequiredError = page.getByText('At least one line is required').first()
    await expect(async () => {
      await page.getByRole('button', { name: 'Post Adjustment' }).click()
      await expect(lineRequiredError).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })
    await expect(page.getByText('Adjustment recorded successfully').first()).toHaveCount(0)

    const itemSelect = adjustForm
      .locator('select')
      .filter({ has: page.locator('option', { hasText: 'Select item' }) })
    await clickStable(page.getByRole('button', { name: 'Add Line' }), itemSelect)
    await itemSelect.selectOption({ index: 1 })
    const qtyInputs = adjustForm.locator('input[type="number"]')
    await qtyInputs.nth(0).fill('10')
    await qtyInputs.nth(1).fill('8')

    await expect(async () => {
      await page.getByRole('button', { name: 'Post Adjustment' }).click()
      await expect(page.getByText('Adjustment recorded successfully').first()).toBeVisible({
        timeout: 3_000,
      })
    }).toPass({ timeout: 15_000 })

    // Cleanup: cancel the session so repeated runs don't pile up count
    // sessions in the shared dev database (the posted adjustment/ledger entry
    // itself has no UI delete path, same tradeoff the backend e2e suite
    // accepts for adjustment fixtures).
    await expect(async () => {
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByText('Count cancelled').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })
  })

  test('user without inventory:stock:adjust cannot reach Stock Counts', async ({ page }) => {
    await loginAs(page, CASHIER_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/stock-counts')
    await expect(page.getByText('Access Forbidden')).toBeVisible({ timeout: 10_000 })
  })
})
