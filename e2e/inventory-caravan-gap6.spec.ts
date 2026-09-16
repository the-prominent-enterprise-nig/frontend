import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Scenario 50 Gap 6 — Caravan fixes on the Serial Number Tracking screen.
 *
 * Covers three of the four sub-asks with a real API round trip (the fourth,
 * "sold items blocked", is pre-existing and untouched — see the plan doc):
 *
 *  1. Same-branch consignment is now allowed. It used to be rejected
 *     outright as a no-op ("consignment only makes sense across branches"),
 *     which blocked exactly the case asked for: a branch running its own
 *     on-site caravan event marking its already-local stock as this event's
 *     caravan stock, with no location change.
 *  2. The ST (transfer) number is now shown alongside RR — previously only
 *     RR was surfaced, ST was nowhere on this screen even though the data
 *     existed via a real (not soft-FK) Prisma relation.
 *  3. Sources for caravan are both real warehouses and branches — proven via
 *     the existing "All Locations" filter, which already lists both kinds
 *     (this was already true before Gap 6; verified, not built).
 *
 * Seeds its own consignment via the API so the assertion is about real data.
 */
test.describe('Inventory — Caravan (Gap 6)', () => {
  test('same-branch consignment succeeds and shows on the Caravan tab', async ({ page }) => {
    await gotoReady(page, '/inventory/serial-numbers')

    const serials = await (
      await page.request.get('/api/inventory/serial-numbers?status=in_stock&limit=200')
    ).json()
    // Not already consigned — a separate, pre-existing guard correctly
    // blocks double-consigning a unit, and status alone (`in_stock`) doesn't
    // change on consignment, so a stale one can still match that filter.
    const withBranch = (serials.data ?? []).find(
      (s: {
        currentWarehouse?: { branchId?: string | null }
        consignedToBranchId?: string | null
      }) => s.currentWarehouse?.branchId && !s.consignedToBranchId
    )
    expect(
      withBranch,
      'an in-stock, not-already-consigned serial owned by a real branch must exist'
    ).toBeTruthy()
    const ownBranchId = withBranch.currentWarehouse.branchId as string

    const consignRes = await page.request.post('/api/inventory/serial-numbers/consign', {
      data: {
        serialNumberIds: [withBranch.id],
        hostBranchId: ownBranchId,
        eventName: `E2E Same-Branch Caravan ${Date.now()}`,
      },
    })
    expect(consignRes.ok(), `consign failed: ${await consignRes.text()}`).toBeTruthy()

    // Location is unchanged — this never moved anything, it only marked the
    // unit as this event's caravan stock.
    const afterRes = await page.request.get('/api/inventory/serial-numbers', {
      params: { consignedToBranchId: ownBranchId, limit: '50' },
    })
    const after = await afterRes.json()
    const found = (after.data ?? []).find((s: { id: string }) => s.id === withBranch.id)
    expect(
      found,
      'the consigned serial must show up under its own branch on the Caravan tab'
    ).toBeTruthy()
    expect(found.currentWarehouseId).toBe(withBranch.currentWarehouseId)
  })

  test('shows the ST number alongside RR', async ({ page }) => {
    await gotoReady(page, '/inventory/serial-numbers')
    await expect(page.getByRole('columnheader', { name: 'RR #' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('columnheader', { name: 'ST #' })).toBeVisible()
  })

  test('the location filter offers both real warehouses and branches as caravan sources', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/serial-numbers')
    const select = page.locator('select').filter({ hasText: 'All Locations' })
    await expect(select).toBeVisible({ timeout: 30_000 })
    // The <select> element renders immediately; its options populate async
    // from useSerialNumbers' own warehouses query, which can still be
    // loading (skeleton rows visible) at the moment the select first mounts.
    await expect
      .poll(async () => (await select.locator('option').count()) > 3, { timeout: 20_000 })
      .toBe(true)
    const optionLabels = await select.locator('option').allInnerTexts()
    // At least one of the two real standalone warehouses, plus at least one
    // ordinary branch — both kinds already selectable, nothing new to build.
    expect(optionLabels.some((l) => /panay|negros/i.test(l))).toBe(true)
    expect(optionLabels.length).toBeGreaterThan(3)
  })
})
