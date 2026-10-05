import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Scenario 50 Gap 6 — fixes on the Serial Number Tracking screen that still
 * stand after Scenario 60 retired consignment (caravans are Stock Transfers
 * now — see scenario-60-caravan-transfer.spec.ts):
 *
 *  1. The ST (transfer) number is shown alongside RR.
 *  2. The location filter offers both real warehouses and branches.
 */
test.describe('Inventory — Caravan (Gap 6)', () => {
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
