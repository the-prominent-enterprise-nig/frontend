import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 29 (Accounting section), closing gap #2 — same cross-cutting gap
// CRM/Inventory had: the dashboard previously only fetched once on mount
// plus a manual Refresh click. Now mirrors CRM's own fix: a 30s interval
// plus a refetch on window focus/visibility change. Waiting a full 30s in
// a test is slow, so this exercises the focus-triggered path instead —
// same `load()` call, much faster to prove.

test.describe('Accounting Dashboard — Auto-Refresh', () => {
  test('refetches when the window regains focus', async ({ page }) => {
    await gotoReady(page, '/accounting')
    await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 15_000 })

    let requestsSinceFocus = 0
    page.on('request', (req) => {
      if (req.url().includes('/api/reports/aging/ar')) requestsSinceFocus++
    })

    await page.evaluate(() => window.dispatchEvent(new Event('focus')))

    await expect(() => expect(requestsSinceFocus).toBeGreaterThan(0)).toPass({
      timeout: 10_000,
    })
  })

  test('refetches when the tab becomes visible again', async ({ page }) => {
    await gotoReady(page, '/accounting')
    await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 15_000 })

    let requestsSinceVisible = 0
    page.on('request', (req) => {
      if (req.url().includes('/api/reports/aging/ar')) requestsSinceVisible++
    })

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await expect(() => expect(requestsSinceVisible).toBeGreaterThan(0)).toPass({
      timeout: 10_000,
    })
  })
})
