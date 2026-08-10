import { test, expect, type Page } from '@playwright/test'
import { gotoReady, clickStable, fillStable, loginAs } from './utils'

// Scenario 16, Part 2 — Item Master Governance frontend UI. Backend workflow
// itself is covered by backend/test/item-master-governance.e2e-spec.ts; this
// spec exercises the actual UI: the create-time draft notice, the status
// badge, and the Submit/Confirm/Approve/Reject row actions + modals across
// the governance personas (Stock Controller, Accountant, Master Data
// Approver — seeded technova.b1.* accounts, prisma/seed.ts).
//
// Test items are created directly via the API (not through the create form —
// already covered by inventory-item-master.spec.ts) so this spec can focus
// on the governance controls, and are deleted in afterEach.
//
// Scenario 22 Part 7 — this spec used to run its item-create/draft steps as
// a separate 'Inventory' role (bare inventory:* wildcard). That role was
// retired as a redundant duplicate of Stock Controller; items:create/update
// moved to Stock Controller (the fixed-role-list member) to close the gap,
// but items:delete deliberately stayed Business-Owner-only, so cleanup now
// runs as Owner instead.

const DEV_PASSWORD = 'dev-prominent-enterprise-2026'
const SEARCH_PLACEHOLDER = 'Search by name or SKU…'
const STOCK_EMAIL = 'technova.b1.stock@test.com'
const OWNER_EMAIL = 'technova.owner@test.com'
const ACCOUNTING_EMAIL = 'technova.b1.accounting@test.com'
const APPROVER_EMAIL = 'technova.b1.approver@test.com'
const CASHIER_EMAIL = 'technova.b1.cashier@test.com'

// loginAs assumes a fresh, unauthenticated session (visiting /login while
// already signed in just redirects away) — clear cookies first so each
// subsequent loginAs call actually lands on the login form.
async function switchTo(page: Page, email: string): Promise<void> {
  await page.context().clearCookies()
  await loginAs(page, email, DEV_PASSWORD)
}

async function createDraftItem(page: Page): Promise<{ id: string; sku: string }> {
  const listRes = await page.request.get('/api/inventory/items?limit=1')
  const listJson = await listRes.json()
  const baseUnitId = listJson.data[0].baseUnit.id
  const sku = `E2E-GOV-${Date.now()}`
  const createRes = await page.request.post('/api/inventory/items', {
    data: { sku, name: 'E2E Governance Test Item', baseUnitId },
  })
  const item = await createRes.json()
  return { id: item.id as string, sku }
}

test.describe('Inventory — Item Master Governance (Scenario 16, Part 2)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  const createdItemIds: string[] = []

  test.afterEach(async ({ page }) => {
    if (!createdItemIds.length) return
    // Delete as Business Owner — items:delete deliberately stayed
    // Owner-only when items:create/update moved to Stock Controller
    // (Scenario 22 Part 7), so none of this spec's personas hold it.
    await switchTo(page, OWNER_EMAIL)
    for (const id of createdItemIds.splice(0)) {
      await page.request.delete(`/api/inventory/items/${id}`).catch(() => {})
    }
  })

  test('create form shows the draft governance notice', async ({ page }) => {
    await loginAs(page, STOCK_EMAIL, DEV_PASSWORD)
    await gotoReady(page, '/inventory/items')
    await clickStable(
      page.getByRole('button', { name: 'Add Item' }),
      page.getByRole('heading', { name: 'Add New Item' })
    )
    await expect(page.getByText(/This item saves as a draft/)).toBeVisible()
  })

  test('walks a draft item through submit → confirm-accounting → approve across roles', async ({
    page,
  }) => {
    await loginAs(page, STOCK_EMAIL, DEV_PASSWORD)
    const { id, sku } = await createDraftItem(page)
    createdItemIds.push(id)

    await gotoReady(page, '/inventory/items')
    await fillStable(page.getByPlaceholder(SEARCH_PLACEHOLDER), sku)
    await expect(page.getByRole('table').getByText('Draft', { exact: true })).toBeVisible({
      timeout: 10_000,
    })

    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(
      page.getByRole('table').getByText('Pending Accounting', { exact: true })
    ).toBeVisible({
      timeout: 10_000,
    })

    // Accountant confirms tax/GL mapping
    await switchTo(page, ACCOUNTING_EMAIL)
    await gotoReady(page, '/inventory/items')
    await fillStable(page.getByPlaceholder(SEARCH_PLACEHOLDER), sku)
    await page.getByRole('button', { name: 'Confirm' }).click()
    const confirmModal = page.getByRole('dialog', { name: 'Confirm Tax/GL Mapping' })
    await expect(confirmModal).toBeVisible()
    await confirmModal.getByRole('button', { name: 'Confirm' }).click()
    await expect(
      page.getByRole('table').getByText('Pending Approval', { exact: true })
    ).toBeVisible({
      timeout: 10_000,
    })

    // Master Data Approver approves — item publishes
    await switchTo(page, APPROVER_EMAIL)
    await gotoReady(page, '/inventory/items')
    await fillStable(page.getByPlaceholder(SEARCH_PLACEHOLDER), sku)
    await page.getByRole('button', { name: 'Approve' }).click()
    const approveModal = page.getByRole('dialog', { name: 'Approve Item' })
    await expect(approveModal).toBeVisible()
    await approveModal.getByRole('button', { name: 'Approve' }).click()
    await expect(
      page.getByRole('table').getByText('Pending Approval', { exact: true })
    ).toHaveCount(0, {
      timeout: 10_000,
    })

    // A Cashier (plain items:read) can now find the approved item via the
    // same search endpoint POS/PO pickers use
    await switchTo(page, CASHIER_EMAIL)
    const res = await page.request.get(`/api/inventory/items?search=${sku}&limit=10`)
    const json = await res.json()
    expect(json.data.some((i: { id: string }) => i.id === id)).toBe(true)
  })

  test('Accountant can reject a submitted item, visible with its reason', async ({ page }) => {
    await loginAs(page, STOCK_EMAIL, DEV_PASSWORD)
    const { id, sku } = await createDraftItem(page)
    createdItemIds.push(id)

    await gotoReady(page, '/inventory/items')
    await fillStable(page.getByPlaceholder(SEARCH_PLACEHOLDER), sku)
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(
      page.getByRole('table').getByText('Pending Accounting', { exact: true })
    ).toBeVisible({
      timeout: 10_000,
    })

    await switchTo(page, ACCOUNTING_EMAIL)
    await gotoReady(page, '/inventory/items')
    await fillStable(page.getByPlaceholder(SEARCH_PLACEHOLDER), sku)
    await page.getByRole('button', { name: 'Reject' }).click()
    const rejectModal = page.getByRole('dialog', { name: 'Reject — Tax/GL Mapping' })
    await expect(rejectModal).toBeVisible()
    const rejectionReason = 'E2E rejection — tax rate looks wrong for this category'
    await fillStable(
      rejectModal.getByPlaceholder('Provide a reason for rejection…'),
      rejectionReason
    )
    await rejectModal.getByRole('button', { name: 'Reject' }).click()

    const rejectedBadge = page.getByRole('table').getByText('Rejected', { exact: true })
    await expect(rejectedBadge).toBeVisible({ timeout: 10_000 })
    await expect(rejectedBadge).toHaveAttribute('title', rejectionReason)
  })

  // A pure items:read caller (Cashier) never sees a draft/pending item in the
  // list the way HO Inventory/Accounting/Approver do — the core governance
  // gate this scenario adds.
  test('a plain items:read caller never sees a draft item in the list', async ({ page }) => {
    await loginAs(page, STOCK_EMAIL, DEV_PASSWORD)
    const { id, sku } = await createDraftItem(page)
    createdItemIds.push(id)

    await switchTo(page, CASHIER_EMAIL)
    await gotoReady(page, '/inventory/items')
    // A later hydration reconciliation can silently wipe the search field
    // after fillStable's own check already passed but before the query
    // re-fetches (same race fillAllStable's docstring describes) — retry
    // the fill+check together so any wipe just re-fills and re-checks.
    await expect(async () => {
      await fillStable(page.getByPlaceholder(SEARCH_PLACEHOLDER), sku)
      await expect(page.getByText('No items found')).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })
  })
})
