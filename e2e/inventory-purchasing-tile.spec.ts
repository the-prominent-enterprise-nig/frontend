import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Regression coverage for Scenario 27, Inventory Part 8: the dashboard had
 * no Purchasing presence at all despite Purchase Requests/Orders being a
 * fully real, existing module — new "Purchasing" tile added to Operations &
 * Movement's previously-unused second column, showing open PR/PO counts and
 * a merged recent-activity list.
 */
test.describe('Inventory — Purchasing tile', () => {
  test('open PR/PO counts and activity list reflect real data', async ({ page }) => {
    const prRes = await page.request.get('/api/procurement/purchase-requests?limit=50')
    const prBody = await prRes.json()
    const openPr = prBody.data.filter((p: any) => ['submitted', 'approved'].includes(p.status))

    const poRes = await page.request.get('/api/procurement/purchase-orders?limit=50')
    const poBody = await poRes.json()
    const openPo = poBody.data.filter(
      (p: any) => !['fully_received', 'closed', 'cancelled'].includes(p.status)
    )

    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await gotoReady(page, '/inventory')
    await expect(page.getByText('Purchasing', { exact: true })).toBeVisible()
    await expect(page.getByText(new RegExp(`^${openPr.length}\\s+Open PRs?$`))).toBeVisible()
    await expect(page.getByText(new RegExp(`^${openPo.length}\\s+Open POs?$`))).toBeVisible()

    if (openPr.length + openPo.length > 0) {
      await expect(page.getByText('No open purchase requests or orders')).not.toBeVisible()
      const first = [...openPr, ...openPo][0]
      await expect(page.getByText(first.code, { exact: false }).first()).toBeVisible()
    } else {
      await expect(page.getByText('No open purchase requests or orders')).toBeVisible()
    }

    await expect(page.getByText('undefined')).toHaveCount(0)
    expect(consoleErrors).toEqual([])
  })
})
