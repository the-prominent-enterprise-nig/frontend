import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Regression coverage for Scenario 27, Inventory Part 6: the dashboard used
 * to fetch all 15 server actions exactly once, on mount, via a manual
 * useState + useEffect + Refresh-button pattern — no auto-refresh. It now
 * runs through a single useQuery (queryFn: load, the same combined 15-action
 * function, unchanged) with refetchInterval: 30_000 + refetchOnWindowFocus,
 * matching POS's existing pattern.
 *
 * Verified indirectly via Next.js Server Action request headers (each
 * `'use server'` action call carries a distinct `next-action` hash) — the
 * same technique used earlier to verify POS's auto-refresh.
 */
test.describe('Inventory — dashboard auto-refresh', () => {
  test('manual Refresh and the 30s interval both re-trigger the full data load', async ({
    page,
  }) => {
    const actionHashes: string[] = []
    page.on('request', (req) => {
      const hash = req.headers()['next-action']
      if (hash) actionHashes.push(hash)
    })

    await gotoReady(page, '/inventory')
    await page.waitForTimeout(1500)
    const initialCount = new Set(actionHashes).size
    expect(initialCount).toBeGreaterThan(5)

    const beforeClick = actionHashes.length
    await page.getByRole('button', { name: /Refresh/i }).click()
    await page.waitForTimeout(1500)
    const clickDelta = new Set(actionHashes.slice(beforeClick)).size
    expect(clickDelta).toBeGreaterThan(5)

    // refetchInterval reschedules from the *completion* of the manual
    // refetch above, not from mount, so give it generous margin beyond the
    // nominal 30s to absorb fetch duration + scheduling overhead.
    const beforePoll = actionHashes.length
    await page.waitForTimeout(36_000)
    const pollDelta = new Set(actionHashes.slice(beforePoll)).size
    expect(pollDelta).toBeGreaterThan(5)
  })
})
