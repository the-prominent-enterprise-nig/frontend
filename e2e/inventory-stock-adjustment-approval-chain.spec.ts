import { test, expect, type Page } from '@playwright/test'
import { gotoReady, loginAs, clickStable } from './utils'

// Scenario 19 Part 2 — approval chain on stock adjustments. Before this
// change, "Post Adjustment" posted ledger/balance/GL immediately with no
// review. Now it only submits a pending adjustment; a Branch Manager must
// confirm it, then the Business Owner investigates and approves/rejects
// before anything actually posts. This spec walks the full chain across
// three role logins on the new "Adjustment Approvals" tab.

const STOCK_CONTROLLER_EMAIL = process.env.E2E_STOCK_EMAIL ?? 'technova.b1.stock@test.com'
const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL ?? 'technova.b1.manager@test.com'
const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'technova.owner@test.com'
const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'

// loginAs assumes a fresh, unauthenticated session (visiting /login while
// already signed in just redirects away) — clear cookies first so each
// subsequent loginAs call actually lands on the login form.
async function switchTo(page: Page, email: string): Promise<void> {
  await page.context().clearCookies()
  await loginAs(page, email, PASSWORD)
  // Bounded settle: a subsequent hard navigation fired immediately after
  // login occasionally races the session cookie being fully committed,
  // landing back on the previous user's page. This is a known-narrow
  // mitigation for that specific race, not a substitute for the retry
  // wrapper callers already use around switchTo.
  await page.waitForTimeout(750)
}

// A dedicated, disposable test item — NOT one shared with other specs.
// Picking an arbitrary dropdown item (index 1) previously landed on another
// suite's fixture item and pushed its real balance negative across repeated
// runs, since the approval chain actually posts real ledger/balance
// mutations on approve(). Unlike the sibling inventory-stock-adjustment.spec
// (which withdraws its still-'submitted' adjustment via
// DELETE /inventory/adjustments/:id, added in Scenario 19 Part 3), THIS
// spec's adjustment gets fully approved — real ledger/balance/GL postings —
// so withdraw (submitted-only) doesn't apply, and there's no delete path for
// an approved adjustment by design (audit integrity). Its
// stock_adjustment_lines FK therefore still blocks the afterEach item
// deletion below; that's a best-effort cleanup, and self-contained pollution
// on our own dedicated item is an accepted tradeoff — corrupting someone
// else's fixture is not.
async function createTestItem(page: Page): Promise<{ id: string; sku: string; name: string }> {
  const listRes = await page.request.get('/api/inventory/items?limit=1')
  const listJson = await listRes.json()
  const baseUnitId = listJson.data[0].baseUnit.id
  const sku = `E2E-ADJCHAIN-${Date.now()}`
  const name = 'E2E Adjustment Approval Chain Test Item'
  const createRes = await page.request.post('/api/inventory/items', {
    data: { sku, name, baseUnitId },
  })
  const item = await createRes.json()
  if (!item?.id) {
    throw new Error(`createTestItem failed (status ${createRes.status()}): ${JSON.stringify(item)}`)
  }

  // New items default to draft (Scenario 16 governance) and are invisible to
  // anyone without a governance permission — the adjustment line-item picker
  // hard-locks non-governance callers to approvalStatus: 'approved'. Push it
  // through submit -> confirm-accounting -> approve as Owner (holds every
  // governance permission) so Stock Controller can actually select it.
  await page.request.post(`/api/inventory/items/${item.id}/submit`)
  await page.request.post(`/api/inventory/items/${item.id}/confirm-accounting`, { data: {} })
  await page.request.post(`/api/inventory/items/${item.id}/approve`, { data: {} })

  return { id: item.id as string, sku, name }
}

test.describe('Inventory — Stock Adjustment approval chain (Scenario 19 Part 2)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  const createdItemIds: string[] = []

  test.afterEach(async ({ page }) => {
    if (!createdItemIds.length) return
    // Best-effort — deleting an item with posted ledger/balance history
    // (which approve() creates) may hit FK constraints; that's fine, same
    // tradeoff the sibling adjustment spec already accepts.
    await switchTo(page, OWNER_EMAIL)
    for (const id of createdItemIds.splice(0)) {
      await page.request.delete(`/api/inventory/items/${id}`).catch(() => {})
    }
  })

  test('submit as Stock Controller, confirm as Branch Manager, investigate+approve as Business Owner', async ({
    page,
  }) => {
    // This test spans item-governance setup plus 3 role logins, each with
    // its own retry budget for the session-settle race — well past the
    // suite's default 60s per-test timeout.
    test.setTimeout(180_000)

    // ── Setup: create a dedicated test item as Owner (Stock Controller only
    // holds inventory:items:read, not :create) ─────────────────────────────
    await loginAs(page, OWNER_EMAIL, PASSWORD)
    // Let the post-login navigation fully settle on a real page before
    // firing page.request calls — every other multi-role spec in this repo
    // does a gotoReady immediately after login for the same reason.
    await gotoReady(page, '/inventory/items')
    const testItem = await createTestItem(page)
    createdItemIds.push(testItem.id)

    // ── Step 1: Stock Controller submits an adjustment ──────────────────────
    // The role switch occasionally lands back on the previous user's
    // dashboard instead of the target page (a stale-navigation race, not a
    // feature bug) — retry the whole switch+navigate until it actually
    // lands on Stock Counts.
    const stockCountsHeading = page.getByRole('heading', { name: 'Stock Counts' })
    await expect(async () => {
      await switchTo(page, STOCK_CONTROLLER_EMAIL)
      await gotoReady(page, '/inventory/stock-counts')
      await expect(stockCountsHeading).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 60_000 })

    // A branch-scoped Stock Controller now only sees their own branch's
    // warehouse, which the modal auto-fills (no <select> at all) — only
    // pick an option when there's an actual choice to make.
    const createSessionButton = page.getByRole('button', { name: 'Create Session' })
    await clickStable(page.getByRole('button', { name: 'New Count' }), createSessionButton)
    // The warehouse field briefly renders as a <select> before the
    // warehouses query resolves into its final auto-fill-or-not state, then
    // swaps out from under an in-flight interaction — bounded settle before
    // touching it (same mitigation as switchTo's session-settle race above).
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

    const freshRow = page.locator('tr').filter({ hasText: 'Scheduled' })
    const sessionId = await freshRow.locator('td').first().innerText()
    const ownRow = page.locator('tr').filter({ hasText: sessionId })

    const sessionHeading = page.getByRole('heading', { name: 'Count Session' })
    await clickStable(ownRow.getByRole('button', { name: 'Open' }), sessionHeading)

    await expect(async () => {
      await page.getByRole('button', { name: 'Start Count' }).click()
      await expect(page.getByText('Count started').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })

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
    await clickStable(adjustTabButton, page.getByRole('button', { name: 'Submit Adjustment' }))

    const adjustForm = page.locator('form').last()
    await adjustForm.locator('textarea').fill('E2E: Scenario 19 Part 2 approval chain test.')

    const itemSelect = adjustForm
      .locator('select')
      .filter({ has: page.locator('option', { hasText: 'Select item' }) })
    await clickStable(page.getByRole('button', { name: 'Add Line' }), itemSelect)
    await itemSelect.selectOption({ label: `${testItem.sku} — ${testItem.name}` })
    const qtyInputs = adjustForm.locator('input[type="number"]')
    await qtyInputs.nth(0).fill('10')
    await qtyInputs.nth(1).fill('8')

    await expect(async () => {
      await page.getByRole('button', { name: 'Submit Adjustment' }).click()
      await expect(page.getByText('pending Branch Manager confirmation').first()).toBeVisible({
        timeout: 3_000,
      })
    }).toPass({ timeout: 15_000 })

    // ── Grab the new adjustment's short ID from the Approvals tab, while
    // still logged in as the creator (who can read but not act on it) ──────
    await gotoReady(page, '/inventory/counting?tab=approvals')
    const submittedRow = page.locator('tr').filter({ hasText: 'Submitted' }).first()
    const adjustmentId = await submittedRow.locator('td').first().innerText()
    const myRow = page.locator('tr').filter({ hasText: adjustmentId })
    await expect(myRow.getByRole('button', { name: 'Confirm' })).toHaveCount(0)

    // ── Step 2: Branch Manager confirms ─────────────────────────────────────
    const approvalsTabHeading = page.getByRole('button', { name: 'Adjustment Approvals' })
    await expect(async () => {
      await switchTo(page, MANAGER_EMAIL)
      await gotoReady(page, '/inventory/counting?tab=approvals')
      await expect(approvalsTabHeading).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 60_000 })
    const managerRow = page.locator('tr').filter({ hasText: adjustmentId })
    await expect(async () => {
      await managerRow.getByRole('button', { name: 'Confirm' }).click()
      await expect(page.getByText('Adjustment confirmed').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })
    await expect(managerRow.getByText('Confirmed', { exact: true })).toBeVisible({
      timeout: 10_000,
    })
    await expect(managerRow.getByRole('button', { name: 'Investigate' })).toHaveCount(0)

    // ── Step 3: Business Owner investigates then approves ──────────────────
    await expect(async () => {
      await switchTo(page, OWNER_EMAIL)
      await gotoReady(page, '/inventory/counting?tab=approvals')
      await expect(approvalsTabHeading).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 60_000 })
    const ownerRow = page.locator('tr').filter({ hasText: adjustmentId })

    await expect(async () => {
      await ownerRow.getByRole('button', { name: 'Investigate' }).click()
      await expect(page.getByText('Investigation started').first()).toBeVisible({
        timeout: 3_000,
      })
    }).toPass({ timeout: 15_000 })
    await expect(ownerRow.getByText('Investigating', { exact: true })).toBeVisible({
      timeout: 10_000,
    })

    await expect(async () => {
      await ownerRow.getByRole('button', { name: 'Approve' }).click()
      await expect(page.getByText('Adjustment approved and posted').first()).toBeVisible({
        timeout: 3_000,
      })
    }).toPass({ timeout: 15_000 })
    await expect(ownerRow.getByText('Approved', { exact: true })).toBeVisible({ timeout: 10_000 })
  })
})
