import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Regression coverage for Scenario 27, Inventory Part 2: the
 * negative-stock-violations action + schema required a `quantity`/`itemSku`/
 * `id` shape the backend never sends (real fields: `onHandQty`/`sku`, no
 * `id`) — this caused zero validation errors before the fix but rendered
 * blank/NaN values and always-critical severity.
 *
 * This file originally also covered the dashboard's "Low Stock Items" panel
 * and the standalone `/inventory/reorder` page — both removed 2026-08-20
 * when `development`'s 2026-08-17 dead-nav sweep retired the `ReorderRule`
 * model backend-wide (reorder-point tracking now always resolves
 * false/empty everywhere), which surfaced during the merge of this branch.
 */
test.describe('Inventory — Negative Stock Violations data integrity', () => {
  test('dashboard Negative Stock Violations panel reflects the real violations response', async ({
    page,
  }) => {
    const apiRes = await page.request.get('/api/inventory/negative-stock/violations')
    expect(apiRes.ok()).toBeTruthy()
    const body = await apiRes.json()
    expect(Array.isArray(body)).toBe(true)

    await gotoReady(page, '/inventory')
    await expect(page.getByText('Negative Stock Violations', { exact: true })).toBeVisible()

    if (body.length > 0) {
      const first = body[0]
      await expect(page.getByText('No negative stock violations')).not.toBeVisible()
      if (first.itemName) {
        await expect(page.getByText(first.itemName, { exact: false }).first()).toBeVisible()
      }
      await expect(page.getByText('undefined')).toHaveCount(0)
    } else {
      await expect(page.getByText('No negative stock violations')).toBeVisible()
    }
  })

  test('standalone negative-stock page loads without shape errors', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await gotoReady(page, '/inventory/negative-stock')

    expect(consoleErrors).toEqual([])
  })
})
