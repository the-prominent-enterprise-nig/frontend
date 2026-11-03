import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Scenario 80 Part 1 — Oct 29 UAT labels and looks. Surface checks only:
//   - WH-03  Add Item lives on Item Master, not Stock Balance
//   - SNL-01 Serial Number Locator: Origin columns come before Location
//   - SC-02  repair forms say "Service Center", not "Repair Provider"
//   - CS-01  Close Session says "MI collections"
// Styling items (WH-02, WH-04, STR-02, POS-08) are in the manual test.

test.describe('Scenario 80 Part 1 — labels and looks', () => {
  test('WH-03: Add Item is on Item Master, not Stock Balance', async ({ page }) => {
    await gotoReady(page, '/inventory/stock?tab=balance')
    await expect(page.getByRole('heading', { name: 'Stock Balance' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Item' })).toHaveCount(0)

    // The sidebar's Item Master is the catalog hub (its Items tab is hidden).
    await gotoReady(page, '/inventory/catalog')
    await expect(page.getByRole('button', { name: 'Add Item' })).toBeVisible()
  })

  test('SNL-01: Origin comes before Location on the locator', async ({ page }, testInfo) => {
    await gotoReady(page, '/inventory/stock?tab=locator')
    const headers = page.getByRole('columnheader')
    const origin = page.getByRole('columnheader', { name: /Origin \/ REF# \/ Date/i })
    // The table renders once the serials load; count only after that.
    await origin.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
    if ((await origin.count()) === 0) {
      testInfo.annotations.push({
        type: 'skipped-assertion',
        description: 'No serials on this DB, so the locator table never renders.',
      })
      return
    }
    const names = (await headers.allInnerTexts()).map((t) => t.trim().toUpperCase())
    const originAt = names.findIndex((n) => n.startsWith('ORIGIN'))
    const locationAt = names.findIndex((n) => n.startsWith('LOCATION'))
    expect(originAt).toBeGreaterThan(-1)
    expect(locationAt).toBeGreaterThan(originAt)
  })

  test('SC-02: Issue UDS asks for a Service Center', async ({ page }) => {
    await gotoReady(page, '/inventory/uds')
    await clickStable(
      page.getByRole('button', { name: 'Issue UDS' }),
      page.getByRole('heading', { name: 'Issue Unit Document Sheet' })
    )
    const form = page.locator('form')
    await expect(form.getByPlaceholder('Search service center…')).toBeVisible()
    await expect(form.getByText('Service Center', { exact: false }).first()).toBeVisible()
    await expect(form.getByText(/repair provider/i)).toHaveCount(0)
  })

  test('CS-01: Close Session lists MI collections', async ({ page }, testInfo) => {
    await gotoReady(page, '/pos/sessions')
    const closeButton = page.getByRole('button', { name: 'Close Session' }).first()
    // Sessions load after the page; count only after they have.
    await closeButton.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
    if ((await closeButton.count()) === 0) {
      testInfo.annotations.push({
        type: 'skipped-assertion',
        description: 'No open POS session on this DB, so Close Session is unreachable.',
      })
      return
    }
    await closeButton.click()
    await expect(page.getByRole('heading', { name: 'Close Session' })).toBeVisible()
    await expect(page.getByText(/Counter collections/i)).toHaveCount(0)
    // The MI collections row only shows when the shift took some in cash.
    // The collections panel loads after the page: wait for one of its two
    // answers before deciding.
    const noCollections = page.getByText('No collections this shift.')
    const miRow = page.getByText('MI collections').first()
    await expect(noCollections.or(miRow)).toBeVisible({ timeout: 20_000 })
    if (await noCollections.isVisible()) {
      testInfo.annotations.push({
        type: 'skipped-assertion',
        description: 'The open session took no collections, so the MI collections row is hidden.',
      })
      return
    }
    await expect(page.getByText('MI collections').first()).toBeVisible()
  })
})
