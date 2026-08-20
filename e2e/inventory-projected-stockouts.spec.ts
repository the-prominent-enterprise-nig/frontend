import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Regression coverage for Scenario 27, Inventory Part 1: the backend's
 * `/inventory/projection/stockout-alerts` returns `{ alertWindowDays, alerts:
 * [...] }` with flat per-item fields (sku/name/warehouseName/currentQty/
 * stockoutDate). The frontend action used to only accept a bare array or
 * `{ data: [...] }`, so it always fell through to `{success:false}` and both
 * screens below always rendered "no risk" regardless of real data.
 */
test.describe('Inventory — Projected Stockouts data integrity', () => {
  test('dashboard panel reflects the real stockout-alerts response, not a silently-failed fetch', async ({
    page,
  }) => {
    const apiRes = await page.request.get('/api/inventory/projection/stockout-alerts?days=30')
    expect(apiRes.ok()).toBeTruthy()
    const body = await apiRes.json()
    expect(Array.isArray(body.alerts)).toBe(true)

    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await gotoReady(page, '/inventory')
    await expect(page.getByText('Projected Stockouts', { exact: true })).toBeVisible()

    if (body.alerts.length > 0) {
      const first = body.alerts[0]
      await expect(page.getByText('No projected stockouts in the next 30 days')).not.toBeVisible()
      await expect(page.getByText(first.name, { exact: false }).first()).toBeVisible()
      await expect(page.getByText('undefined')).toHaveCount(0)
      await expect(page.getByText(/NaNd/)).toHaveCount(0)
    } else {
      await expect(page.getByText('No projected stockouts in the next 30 days')).toBeVisible()
    }

    expect(consoleErrors).toEqual([])
  })

  test('standalone projection page reflects the same real data', async ({ page }) => {
    const apiRes = await page.request.get('/api/inventory/projection/stockout-alerts?days=30')
    const body = await apiRes.json()

    await gotoReady(page, '/inventory/projection')

    if (body.alerts.length > 0) {
      const first = body.alerts[0]
      await expect(
        page.getByText(new RegExp(`Stockout Alerts \\(${body.alerts.length}\\)`))
      ).toBeVisible()
      await expect(page.getByText(first.name, { exact: false }).first()).toBeVisible()
      await expect(page.getByText('undefined')).toHaveCount(0)
    }
  })
})
