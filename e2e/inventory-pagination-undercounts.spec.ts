import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Regression coverage for Scenario 27, Inventory Part 3 (+ Part 3b): the
 * dashboard's category/warehouse valuation charts and On Hand/Available Qty
 * KPIs used to be built from a 50-row (valuation) / 500-row (stock balances)
 * default page, while the totals shown beside them were computed over the
 * full unpaginated set — so the chart proportions never summed to the number
 * displayed next to them, and the KPIs undercounted real totals.
 *
 * Part 3 initially fixed this by raising the fetch limit; Part 3b replaced
 * that with real server-side aggregation (`summary.byCategory`/`byWarehouse`
 * on the valuation report, `summary.totalOnHandQty`/etc. on stock balances),
 * so the dashboard now requests a minimal page (`limit=1`) and still gets a
 * correct summary — smaller payload, same correctness.
 */
test.describe('Inventory — pagination-vs-total undercount', () => {
  test('valuation and balance summaries are correct even at the smallest possible page size', async ({
    page,
  }) => {
    const valRes = await page.request.get('/api/inventory/reports/valuation?limit=1')
    const valBody = await valRes.json()
    expect(valBody.data.length).toBe(1)
    expect(Array.isArray(valBody.summary.byCategory)).toBe(true)
    expect(Array.isArray(valBody.summary.byWarehouse)).toBe(true)
    const catSum = valBody.summary.byCategory.reduce(
      (s: number, c: { totalValue: number }) => s + c.totalValue,
      0
    )
    expect(catSum).toBeCloseTo(valBody.summary.totalValue, 1)

    const balRes = await page.request.get('/api/inventory/stock/balances?limit=1')
    const balBody = await balRes.json()
    expect(balBody.data.length).toBe(1)
    expect(typeof balBody.summary.totalOnHandQty).toBe('number')
    expect(typeof balBody.summary.totalAvailableQty).toBe('number')
    expect(balBody.summary.totalOnHandQty).toBeGreaterThan(0)

    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await gotoReady(page, '/inventory')
    await expect(page.getByText('Total Inventory Value', { exact: true })).toBeVisible()
    await expect(page.getByText('Inventory Value by Category', { exact: true })).toBeVisible()
    expect(consoleErrors).toEqual([])
  })
})
