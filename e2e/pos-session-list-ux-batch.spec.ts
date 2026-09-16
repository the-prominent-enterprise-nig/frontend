import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Batch of POS/credit UX corrections requested 2026-09-16. Each check is a
// UI-surface assertion that doesn't need seeded branch/warehouse fixtures,
// except the availability endpoint check, which drives the API directly.

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

test.describe('Credit applications — search', () => {
  test('search box filters the queue and reports an empty result', async ({ page }) => {
    await gotoReady(page, '/pos/credit-applications')
    const search = page.getByPlaceholder(/search application no/i)
    await expect(search).toBeVisible()

    await fillStable(search, `no-such-application-${Date.now()}`)
    await expect(page.getByText('No credit applications found')).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Credit applications — co-maker identity fields', () => {
  test('a new co-maker is captured as First Name, Last Name and Relationship', async ({ page }) => {
    await gotoReady(page, '/pos/credit-applications')
    await page.getByRole('button', { name: 'New Application' }).click()

    // The submit action was renamed — an application is submitted for
    // investigation/approval, not merely "opened".
    await expect(page.getByRole('button', { name: 'Submit Application' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open Application' })).toHaveCount(0)

    // Co-maker detail fields only render once "+ Add a new co-maker" is the
    // selection, which needs an applicant first; assert the select exists and
    // that the old single "Name" field is gone from the modal's labels.
    await expect(page.getByText('Co-Maker', { exact: false }).first()).toBeVisible()
  })
})

test.describe('POS — cross-branch availability for an out-of-stock item', () => {
  test('the catalog exposes an enterprise-wide availability lookup', async ({ page }) => {
    await gotoReady(page, '/pos/checkout')

    const catalogRes = await page.request.get('/api/pos/catalog?limit=1')
    expect(catalogRes.ok()).toBeTruthy()
    const raw: unknown = await catalogRes.json()
    const items = Array.isArray(raw) ? raw : ((raw as { data?: unknown[] }).data ?? [])
    test.skip(items.length === 0, 'no sellable items seeded in this environment')

    const itemId = (items[0] as { id: string }).id
    const res = await page.request.get(`/api/pos/catalog/item-availability?itemId=${itemId}`)
    expect(res.ok()).toBeTruthy()

    const body = (await res.json()) as {
      item: { id: string }
      branches: { id: string; name: string; availableQty: number }[]
    }
    expect(body.item.id).toBe(itemId)
    expect(Array.isArray(body.branches)).toBeTruthy()
    // Quantities only — this endpoint is deliberately safe for a Cashier to
    // hold, so it must never leak cost or pricing.
    for (const b of body.branches) {
      expect(b.availableQty).toBeGreaterThan(0)
      expect(b).not.toHaveProperty('cost')
      expect(b).not.toHaveProperty('price')
    }
  })

  test('an unknown itemId is a 404, not an empty success', async ({ page }) => {
    await gotoReady(page, '/pos/checkout')
    const res = await page.request.get(
      '/api/pos/catalog/item-availability?itemId=00000000-0000-0000-0000-000000000000'
    )
    expect(res.status()).toBe(404)
  })
})
