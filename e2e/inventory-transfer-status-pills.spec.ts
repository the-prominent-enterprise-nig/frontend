import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Regression coverage for Scenario 27, Inventory Part 5: the Transfer
 * Activity status-pill strip only covered 4 of 9 real StockTransferStatus
 * enum values (in_transit/draft/received/cancelled), silently omitting
 * pending_manager_approval/requested/pending_hq_approval/rejected/
 * partially_received. Separately, the pill counts were computed from the
 * "recent 8" sliced list rather than the full fetched transfer list, so
 * they'd undercount once real transfer volume exceeds 8.
 *
 * Refined after initial implementation: with 9 possible statuses, always
 * rendering all of them (mostly at 0) read as cluttered, so the strip now
 * only shows a pill for a status once it actually has ≥1 transfer — still
 * covers all 9 (nothing is hardcoded to a subset), just doesn't render the
 * ones with nothing to show.
 */
test.describe('Inventory — Transfer Activity status pills', () => {
  test('only non-zero transfer statuses render a pill, and counts reflect the full list not the recent-8 slice', async ({
    page,
  }) => {
    const apiRes = await page.request.get('/api/inventory/transfers?limit=10000')
    const apiBody = await apiRes.json()
    const realCounts: Record<string, number> = {}
    for (const t of apiBody.data) {
      realCounts[t.status] = (realCounts[t.status] ?? 0) + 1
    }

    const allStatuses = [
      { key: 'pending_manager_approval', label: 'Mgr Approval' },
      { key: 'requested', label: 'Requested' },
      { key: 'pending_hq_approval', label: 'HQ Approval' },
      { key: 'rejected', label: 'Rejected' },
      { key: 'draft', label: 'Draft' },
      { key: 'in_transit', label: 'In Transit' },
      { key: 'partially_received', label: 'Partial' },
      { key: 'received', label: 'Received' },
      { key: 'cancelled', label: 'Cancelled' },
    ]

    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await gotoReady(page, '/inventory')
    await expect(page.getByText('Transfer Activity', { exact: true })).toBeVisible()

    for (const { key, label } of allStatuses) {
      const count = realCounts[key] ?? 0
      const pill = page.getByText(new RegExp(`^${count}\\s+${label}$`))
      if (count > 0) {
        await expect(pill).toBeVisible()
      } else {
        await expect(pill).toHaveCount(0)
      }
    }

    expect(consoleErrors).toEqual([])
  })
})
