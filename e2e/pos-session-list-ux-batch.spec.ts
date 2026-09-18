import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Batch of POS UX corrections requested 2026-09-16. Each check is a
// UI-surface assertion that doesn't need seeded branch/warehouse fixtures.

test.describe('POS — opening balance', () => {
  test('Open Session shows an explicit 0.00 opening cash, not a blank box', async ({ page }) => {
    await gotoReady(page, '/pos/sessions')
    await page.getByRole('button', { name: 'Open Session' }).first().click()

    const openingCash = page.locator('input[type="number"]').first()
    await expect(openingCash).toBeVisible()
    // The till legitimately opens empty — a blank field left cashiers unsure
    // whether zero had been accepted at all.
    await expect(openingCash).toHaveValue('0.00')
  })
})

test.describe('POS — release approvals reachable from the checkout tab bar', () => {
  test('Release Approvals is a tab alongside Checkout, and still has its own page', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/checkout')
    // Scoped to PosNav: the sidebar already carries its own Release Approvals
    // link, so an unscoped role lookup matches two elements.
    const tabBar = page.getByLabel('POS section tabs')
    const tab = tabBar.getByRole('link', { name: 'Release Approvals' })
    await expect(tab).toBeVisible()

    await tab.click()
    await expect(page).toHaveURL(/\/pos\/release-approvals$/)
    // The standalone page is kept, and the tab bar stays visible on it so the
    // cashier can get straight back to Checkout.
    await expect(tabBar.getByRole('link', { name: 'Checkout' })).toBeVisible()
  })
})

test.describe('POS — out-of-stock items open the cross-branch request picker', () => {
  // Review on the POS/credit UX batch: an out-of-stock tile must lead to the
  // existing serial picker — "Also available elsewhere" -> Request — not a
  // read-only availability list. The picker already handles zero local
  // stock, so the tile just adds the item like any other. Read-only: opens
  // the picker and closes it, never raises a request.
  test('clicking an out-of-stock serialized item opens the serial picker, and closing it leaves the cart empty', async ({
    page,
  }) => {
    await gotoReady(page, '/pos/checkout')

    const sessionsRes = await page.request.get('/api/pos/sessions?status=open')
    expect(sessionsRes.ok()).toBeTruthy()
    const rawSessions: unknown = await sessionsRes.json()
    type OpenSession = { id: string; terminal?: { branchId?: string; branch?: { id?: string } } }
    const sessions = (
      Array.isArray(rawSessions) ? rawSessions : ((rawSessions as { data?: unknown[] }).data ?? [])
    ) as OpenSession[]
    test.skip(sessions.length === 0, 'no open POS session in this environment')
    const session = sessions[0]
    const branchId = session.terminal?.branchId ?? session.terminal?.branch?.id
    test.skip(!branchId, 'open session has no resolvable branch')

    // Several open sessions render a picker in the top bar and leave stock
    // unresolved (no out-of-stock labels at all) until one is chosen.
    const sessionSelect = page
      .locator('select')
      .filter({ has: page.locator('option', { hasText: 'Select session…' }) })
    // isVisible() doesn't wait — right after navigation the sessions query is
    // still a skeleton. The API already says whether the picker will render
    // (more than one open session), so wait for it deterministically.
    if (sessions.length > 1) {
      await sessionSelect.waitFor({ state: 'visible', timeout: 15_000 })
      await expect(async () => {
        await sessionSelect.selectOption(session.id)
        await expect(sessionSelect).toHaveValue(session.id)
      }).toPass({ timeout: 10_000 })
    }

    const catalogRes = await page.request.get(`/api/pos/catalog?branchId=${branchId}`)
    expect(catalogRes.ok()).toBeTruthy()
    const rawItems: unknown = await catalogRes.json()
    type CatalogItem = { sku?: string; isSerialTracked?: boolean; stockQty?: number }
    const items = (
      Array.isArray(rawItems) ? rawItems : ((rawItems as { data?: unknown[] }).data ?? [])
    ) as CatalogItem[]
    const target = items.find((i) => i.isSerialTracked && (i.stockQty ?? 0) === 0 && i.sku)
    test.skip(!target, 'no out-of-stock serialized item at this branch')

    await fillStable(page.getByPlaceholder('Search by name or serial'), target!.sku!)
    const tile = page.getByRole('button').filter({ hasText: target!.sku! }).first()
    await expect(tile).toContainText('Out of stock · find branch', { timeout: 15_000 })
    await expect(tile).toBeEnabled()

    await tile.click()
    await expect(page.getByRole('heading', { name: 'Select Serial Number' })).toBeVisible()
    await expect(
      page.getByText('No available serial numbers in stock for this item at this branch.')
    ).toBeVisible()

    // Closing without picking a serial must not strand a serial-less line.
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('heading', { name: 'Select Serial Number' })).toHaveCount(0)
    await expect(page.getByText('Click an item above to add it to the cart')).toBeVisible()
  })
})
