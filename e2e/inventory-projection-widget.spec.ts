import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Regression coverage for Scenario 27, Inventory Part 7: getProjection was
 * fetched on every dashboard load and never read anywhere (dead network
 * call) — and its response adapter + zod schema had the exact same
 * never-matches-reality bug Part 1 fixed for stockout-alerts (nested
 * item/warehouse objects, currentOnHand/incomingQty/etc. fields that don't
 * exist). Now wired into a real "Trending Toward Reorder" widget — items
 * projected to cross their reorder point within the window but not already
 * flagged as a full stockout — distinct from both Low Stock Items (already
 * below reorder today) and Projected Stockouts (headed to zero).
 *
 * The standalone /inventory/projection table (ProjectionPageView.tsx) had
 * the identical dead-field bug and is fixed here too — same root cause
 * reaching a second screen, same pattern as Part 1.
 */
test.describe('Inventory — Trending Toward Reorder widget', () => {
  test('dashboard widget reflects the real projection response', async ({ page }) => {
    const apiRes = await page.request.get('/api/inventory/projection?days=30')
    expect(apiRes.ok()).toBeTruthy()
    const body = await apiRes.json()
    expect(Array.isArray(body.items)).toBe(true)
    const trending = body.items.filter((i: any) => i.atReorderLevel && !i.projectedStockout)

    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await gotoReady(page, '/inventory')
    await expect(page.getByText('Trending Toward Reorder', { exact: true })).toBeVisible()

    if (trending.length > 0) {
      await expect(page.getByText('No items trending toward reorder')).not.toBeVisible()
      await expect(page.getByText(trending[0].name, { exact: false }).first()).toBeVisible()
    } else {
      await expect(page.getByText('No items trending toward reorder')).toBeVisible()
    }

    await expect(page.getByText('undefined')).toHaveCount(0)
    expect(consoleErrors).toEqual([])
  })

  test('standalone projection page renders real field values, not dead nested fields', async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await gotoReady(page, '/inventory/projection')
    await expect(page.getByText('Min Projected Bal.', { exact: true })).toBeVisible()
    await expect(page.getByText('undefined')).toHaveCount(0)
    expect(consoleErrors).toEqual([])
  })
})
