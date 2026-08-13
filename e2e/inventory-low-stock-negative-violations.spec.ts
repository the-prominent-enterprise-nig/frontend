import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Regression coverage for Scenario 27, Inventory Part 2: the reorder-alerts
 * action read `alert.currentQty` (doesn't exist — backend sends
 * `currentAvailableQty`/`currentOnHandQty`/`shortfall`), and the
 * negative-stock-violations action + schema required a `quantity`/`itemSku`/
 * `id` shape the backend never sends (real fields: `onHandQty`/`sku`, no
 * `id`) — both caused zero validation errors before this fix but rendered
 * blank/NaN values and always-critical severity.
 */
test.describe('Inventory — Low Stock & Negative Stock Violations data integrity', () => {
  test('dashboard Low Stock panel reflects the real reorder-alerts response', async ({ page }) => {
    const apiRes = await page.request.get('/api/inventory/stock/reorder-alerts')
    expect(apiRes.ok()).toBeTruthy()
    const body = await apiRes.json()
    expect(Array.isArray(body.data)).toBe(true)

    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await gotoReady(page, '/inventory')
    await expect(page.getByText('Low Stock Items', { exact: true })).toBeVisible()

    if (body.data.length > 0) {
      const first = body.data[0]
      await expect(page.getByText('All stock levels are healthy')).not.toBeVisible()
      if (first.item?.name) {
        await expect(page.getByText(first.item.name, { exact: false }).first()).toBeVisible()
      }
      await expect(page.getByText('undefined')).toHaveCount(0)
      await expect(page.getByText(/NaN/)).toHaveCount(0)
    } else {
      await expect(page.getByText('All stock levels are healthy')).toBeVisible()
    }

    expect(consoleErrors).toEqual([])
  })

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

  test('standalone reorder and negative-stock pages load without shape errors', async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    const alertsRes = await page.request.get('/api/inventory/stock/reorder-alerts')
    const alertsBody = await alertsRes.json()

    await gotoReady(page, '/inventory/reorder')
    await expect(page.getByText('Reorder Management', { exact: true })).toBeVisible()
    if (alertsBody.data.length > 0) {
      await expect(page.getByText('Auto-PR', { exact: true })).toBeVisible()
    } else {
      await expect(page.getByText('No low-stock alerts')).toBeVisible()
    }

    await gotoReady(page, '/inventory/negative-stock')

    expect(consoleErrors).toEqual([])
  })
})
