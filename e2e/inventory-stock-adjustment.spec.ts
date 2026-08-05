import { test, expect, type Page } from '@playwright/test'
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
// Marketing Manager, not Cashier — Cashier legitimately holds
// inventory:serial:read (for looking up a unit at checkout), which is one
// of the Counting hub's own canAny() access-gate permissions, so a Cashier
// can now reach /inventory/counting. Marketing Manager holds none of the
// hub's permissions, so it's the one that actually still gets denied.
const NO_ACCESS_EMAIL = process.env.E2E_MARKETING_EMAIL ?? 'technova.b1.crm@test.com'
const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'technova.owner@test.com'
const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'

// loginAs assumes a fresh, unauthenticated session (visiting /login while
// already signed in just redirects away) — clear cookies first so each
// subsequent loginAs call actually lands on the login form.
async function switchTo(page: Page, email: string): Promise<void> {
  await page.context().clearCookies()
  await loginAs(page, email, PASSWORD)
}

// A dedicated, disposable test item — picking an arbitrary dropdown item
// (index 1) previously landed repeatedly on another suite's shared fixture
// item ("E2E Transfer Manager Approval Bulk Item"), leaving submitted-only
// adjustment noise against it on every run. Scenario 19 Part 3 added
// DELETE /inventory/adjustments/:id (withdraw), which is a safe hard delete
// for still-'submitted' adjustments — zero stock/ledger/GL side effects ever
// posted for them. That means this test's adjustment no longer has to be
// left behind, so its item's stock_adjustment_lines FK no longer blocks
// deletion either: fresh SKU per run, withdrawn + deleted in afterEach, zero
// permanent footprint.
async function createTestItem(page: Page): Promise<{ id: string; sku: string; name: string }> {
  const listRes = await page.request.get('/api/inventory/items?limit=1')
  const listJson = await listRes.json()
  const baseUnitId = listJson.data[0].baseUnit.id
  const sku = `E2E-ADJUST-${Date.now()}`
  const name = 'E2E Stock Adjustment Test Item'
  const createRes = await page.request.post('/api/inventory/items', {
    data: { sku, name, baseUnitId },
  })
  const item = await createRes.json()
  if (!item?.id) {
    throw new Error(`createTestItem failed (status ${createRes.status()}): ${JSON.stringify(item)}`)
  }

  // New items default to draft (Scenario 16 governance) and are invisible to
  // anyone without a governance permission — push it through
  // submit -> confirm-accounting -> approve as Owner so Stock Controller can
  // actually select it.
  await page.request.post(`/api/inventory/items/${item.id}/submit`)
  await page.request.post(`/api/inventory/items/${item.id}/confirm-accounting`, { data: {} })
  await page.request.post(`/api/inventory/items/${item.id}/approve`, { data: {} })
  return { id: item.id as string, sku, name }
}

test.describe('Inventory — Stock Adjustments (INV-64)', () => {
  const createdItemIds: string[] = []

  test.afterEach(async ({ page }) => {
    if (!createdItemIds.length) return
    await switchTo(page, OWNER_EMAIL)
    for (const id of createdItemIds.splice(0)) {
      await page.request.delete(`/api/inventory/items/${id}`).catch(() => {})
    }
  })

  test('Stock Controller can post a stock adjustment with reason code and line items', async ({
    page,
  }) => {
    await loginAs(page, OWNER_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/items')
    const testItem = await createTestItem(page)
    createdItemIds.push(testItem.id)

    await switchTo(page, STOCK_CONTROLLER_EMAIL)
    await gotoReady(page, '/inventory/counting')

    // A branch-scoped Stock Controller now only sees their own branch's
    // warehouse, which the modal auto-fills (no <select> at all) — only
    // pick an option when there's an actual choice to make.
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
      await warehouseSelect.selectOption({ index: 1 })
    }

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
    await clickStable(ownRow, sessionHeading)

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
      await clickStable(ownRow, sessionHeading)
    }
    await expect(adjustTabButton).toBeVisible({ timeout: 10_000 })
    await clickStable(adjustTabButton, page.getByRole('button', { name: 'Submit for Review' }))

    const adjustForm = page.locator('form').last()
    const submitNotes = 'E2E: recount variance from automated test.'
    await adjustForm.locator('textarea').fill(submitNotes)

    // Submitting with zero lines must still be blocked client-side — this is
    // the exact bug INV-64 shipped with (the array was always empty).
    const lineRequiredError = page.getByText('At least one line is required').first()
    await expect(async () => {
      await page.getByRole('button', { name: 'Submit for Review' }).click()
      await expect(lineRequiredError).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })
    await expect(page.getByText('Adjustment submitted').first()).toHaveCount(0)

    const itemSelect = adjustForm
      .locator('select')
      .filter({ has: page.locator('option', { hasText: 'Select item' }) })
    await clickStable(page.getByRole('button', { name: 'Add Line' }), itemSelect)
    await itemSelect.selectOption({ label: `${testItem.sku} — ${testItem.name}` })
    const qtyInputs = adjustForm.locator('input[type="number"]')
    await qtyInputs.nth(0).fill('10')
    await qtyInputs.nth(1).fill('8')

    await expect(async () => {
      await page.getByRole('button', { name: 'Submit for Review' }).click()
      await expect(page.getByText('Adjustment submitted').first()).toBeVisible({
        timeout: 3_000,
      })
    }).toPass({ timeout: 15_000 })

    // Cleanup: cancel the session so repeated runs don't pile up count
    // sessions in the shared dev database.
    await expect(async () => {
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByText('Count cancelled').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })

    // Cleanup: withdraw the adjustment itself. A still-'submitted'
    // adjustment carries zero stock/ledger/GL side effects (posting only
    // happens on approve()), so DELETE /inventory/adjustments/:id is a safe
    // hard delete — Scenario 19 Part 3 added this specifically so tests like
    // this one don't leave permanent rows in the real Adjustment Approvals
    // list that a real Branch Manager/Owner would otherwise see forever.
    await switchTo(page, OWNER_EMAIL)
    const listRes = await page.request.get('/api/inventory/adjustments?status=submitted&limit=50')
    const listJson = await listRes.json()
    const created = (listJson.data ?? []).find((a: { notes?: string }) => a.notes === submitNotes)
    if (created) {
      await page.request.delete(`/api/inventory/adjustments/${created.id}`)
    }
  })

  test('user without inventory:stock:adjust cannot reach Counting', async ({ page }) => {
    await loginAs(page, NO_ACCESS_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/counting')
    await expect(page.getByText('Access Forbidden')).toBeVisible({ timeout: 10_000 })
  })
})
