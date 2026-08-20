import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Regression coverage for Scenario 27, Inventory Part 9 (final part): the
 * real Stock Adjustment approve/reject/investigate workflow (Scenario 19)
 * had zero dashboard visibility — unlike Accounting's "Overdue Bills"/
 * "Budget Alerts" parallel. New "Adjustments Pending Investigation" panel
 * added as the third column of the Planning section (previously 2-column,
 * Active Backorders + Negative Stock Violations).
 */
test.describe('Inventory — Adjustments Pending Investigation tile', () => {
  test('panel reflects real adjustments not yet approved or rejected', async ({ page }) => {
    const apiRes = await page.request.get('/api/inventory/adjustments?limit=50')
    expect(apiRes.ok()).toBeTruthy()
    const body = await apiRes.json()
    const pending = body.data.filter((a: any) =>
      ['submitted', 'confirmed', 'investigating'].includes(a.status)
    )

    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await gotoReady(page, '/inventory')
    await expect(page.getByText('Adjustments Pending Investigation', { exact: true })).toBeVisible()

    if (pending.length > 0) {
      await expect(page.getByText('No adjustments pending investigation')).not.toBeVisible()
      await expect(
        page.getByText(pending[0].adjustmentNumber, { exact: false }).first()
      ).toBeVisible()
    } else {
      await expect(page.getByText('No adjustments pending investigation')).toBeVisible()
    }

    await expect(page.getByText('undefined')).toHaveCount(0)
    expect(consoleErrors).toEqual([])
  })
})
