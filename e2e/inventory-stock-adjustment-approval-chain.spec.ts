import { test, expect, type Page } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// Scenario 19, Part 2 — Stock Adjustment approval chain frontend UI. Backend
// workflow itself is covered by
// backend/test/inventory-stock-adjustment-approval-chain.e2e-spec.ts; this
// spec exercises the actual UI: the status badge, and the
// Confirm/Investigate/Approve/Reject actions across the approval personas.
//
// This repo's Scenario 19 role decision is Business Owner exclusively does
// investigate + approve/reject; Branch Manager only confirms — there's no
// separate "HO Inventory" or "Accountant" role in the chain, unlike the
// PDF's generic description.
//
// The adjustment itself is created directly via the API (not through the
// Stock Counts "Create Adjustment" tab — already covered by
// inventory-stock-adjustment.spec.ts) so this spec can focus purely on the
// approval-chain controls.

const DEV_PASSWORD = 'dev-prominent-enterprise-2026'
const STOCK_EMAIL = 'technova.b1.stock@test.com'
const MANAGER_EMAIL = 'technova.b1.manager@test.com'
const OWNER_EMAIL = 'technova.owner@test.com'

// loginAs assumes a fresh, unauthenticated session (visiting /login while
// already signed in just redirects away) — clear cookies first so each
// subsequent loginAs call actually lands on the login form.
async function switchTo(page: Page, email: string): Promise<void> {
  await page.context().clearCookies()
  await loginAs(page, email, DEV_PASSWORD)
}

// A hard navigation fired immediately after switchTo() occasionally races
// the session cookie being fully committed, landing back on /login instead
// of the target page — a known, only-partially-mitigated race in this
// repo's multi-role specs. Retry the whole switch+navigate+assert until it
// actually lands.
async function switchToAndOpen(page: Page, email: string, locator: ReturnType<Page['locator']>) {
  await expect(async () => {
    await switchTo(page, email)
    await gotoReady(page, '/inventory/counting?tab=adjustments')
    await expect(locator).toBeVisible({ timeout: 5_000 })
  }).toPass({ timeout: 60_000 })
}

async function createAdjustment(page: Page): Promise<{ id: string; adjustmentNumber: string }> {
  const warehousesRes = await page.request.get('/api/inventory/warehouses?limit=200')
  const warehouses = ((await warehousesRes.json()).data ?? []) as { id: string }[]
  const warehouseId = warehouses[0].id

  const itemsRes = await page.request.get('/api/inventory/items?limit=1')
  const items = ((await itemsRes.json()).data ?? []) as { id: string }[]
  const itemId = items[0].id

  const res = await page.request.post('/api/inventory/adjustments', {
    data: {
      warehouseId,
      adjustmentDate: new Date().toISOString().slice(0, 10),
      reasonCode: 'miscounted',
      notes: `E2E approval chain UI test ${Date.now()}`,
      lines: [{ itemId, expectedQty: 10, actualQty: 8, unitCost: 5 }],
    },
  })
  const body = await res.json()
  return { id: body.id as string, adjustmentNumber: body.adjustmentNumber as string }
}

test.describe('Inventory — Stock Adjustment Approval Chain UI (Scenario 19, Part 2)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('walks a submitted adjustment through confirm → investigate → approve across roles', async ({
    page,
  }) => {
    // Spans item-governance-free adjustment creation plus 2 role logins,
    // each with its own retry budget for the session-settle race — well
    // past the suite's default 60s per-test timeout.
    test.setTimeout(180_000)

    await loginAs(page, STOCK_EMAIL, DEV_PASSWORD)
    const { id, adjustmentNumber } = await createAdjustment(page)

    // Branch Manager confirms
    const ownRow = page.locator('tr').filter({ hasText: adjustmentNumber })
    await switchToAndOpen(page, MANAGER_EMAIL, ownRow)
    await expect(ownRow.getByText('Submitted', { exact: true })).toBeVisible()

    const detailHeading = page.getByRole('heading', { name: `Adjustment ${adjustmentNumber}` })
    await ownRow.click()
    await expect(detailHeading).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Confirm' }).click()
    await expect(page.getByText('Adjustment confirmed').first()).toBeVisible({ timeout: 5_000 })

    // Business Owner moves it into investigation, then approves — this
    // repo's role decision keeps both steps with the same actor.
    await switchToAndOpen(page, OWNER_EMAIL, ownRow)
    await ownRow.click()
    await expect(detailHeading).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Move to Investigating' }).click()
    await expect(page.getByText('Moved to investigating').first()).toBeVisible({ timeout: 5_000 })

    await page.getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByText('Adjustment approved').first()).toBeVisible({ timeout: 5_000 })

    const detail = await page.request.get(`/api/inventory/adjustments/${id}`)
    const detailBody = await detail.json()
    expect(detailBody.status).toBe('approved')
    expect(detailBody.journalEntryId).toBeTruthy()
  })

  test('Business Owner can reject an investigated adjustment, visible with its reason', async ({
    page,
  }) => {
    test.setTimeout(120_000)

    await loginAs(page, STOCK_EMAIL, DEV_PASSWORD)
    const { id, adjustmentNumber } = await createAdjustment(page)

    await switchTo(page, MANAGER_EMAIL)
    await page.request.patch(`/api/inventory/adjustments/${id}/confirm`)

    const ownRow = page.locator('tr').filter({ hasText: adjustmentNumber })
    await switchToAndOpen(page, OWNER_EMAIL, ownRow)
    await page.request.patch(`/api/inventory/adjustments/${id}/investigate`)
    await page.reload()
    await expect(ownRow).toBeVisible({ timeout: 10_000 })
    await ownRow.click()
    await expect(page.getByRole('heading', { name: `Adjustment ${adjustmentNumber}` })).toBeVisible(
      { timeout: 10_000 }
    )

    await page.getByRole('button', { name: 'Reject' }).click()
    await page.getByPlaceholder('Reason for rejecting…').fill('E2E: recount looks like a mistake')
    await page.getByRole('button', { name: 'Confirm Rejection' }).click()
    await expect(page.getByText('Adjustment rejected').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('E2E: recount looks like a mistake')).toBeVisible()

    const detail = await page.request.get(`/api/inventory/adjustments/${id}`)
    const detailBody = await detail.json()
    expect(detailBody.status).toBe('rejected')
    expect(detailBody.journalEntryId).toBeFalsy()
  })

  test('the creator (Stock Controller) sees the list but has no action buttons on their own submission', async ({
    page,
  }) => {
    await loginAs(page, STOCK_EMAIL, DEV_PASSWORD)
    const { adjustmentNumber } = await createAdjustment(page)

    await gotoReady(page, '/inventory/counting?tab=adjustments')
    const ownRow = page.locator('tr').filter({ hasText: adjustmentNumber })
    await expect(ownRow).toBeVisible({ timeout: 10_000 })
    await ownRow.click()
    await expect(page.getByRole('heading', { name: `Adjustment ${adjustmentNumber}` })).toBeVisible(
      { timeout: 10_000 }
    )

    await expect(page.getByRole('button', { name: 'Confirm' })).toHaveCount(0)
    await expect(
      page.getByText(/Waiting on the next step — you don.t hold the permission for it\./)
    ).toBeVisible()
  })
})
