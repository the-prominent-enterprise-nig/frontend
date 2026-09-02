import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 29 (CRM section), closing gap #4 — the dashboard previously only
// fetched once on mount plus a manual Refresh click (cross-cutting finding
// #1: confirmed no refetchInterval/refetchOnWindowFocus/setInterval
// anywhere in the file). Now mirrors POS's own overview page: a 30s
// interval plus a refetch on window focus/visibility change. Waiting a
// full 30s in a test is slow, so this exercises the focus-triggered path
// instead — same `load()` call, much faster to prove.

test.describe('CRM Dashboard — Auto-Refresh', () => {
  test('refetches when the window regains focus', async ({ page }) => {
    await gotoReady(page, '/crm')

    // Let the initial mount fetch settle first so it doesn't get counted as
    // the "refetch."
    await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 15_000 })

    let requestsSinceFocus = 0
    page.on('request', (req) => {
      if (req.url().includes('/api/crm/leads/status-summary')) requestsSinceFocus++
    })

    await page.evaluate(() => window.dispatchEvent(new Event('focus')))

    await expect(() => expect(requestsSinceFocus).toBeGreaterThan(0)).toPass({
      timeout: 10_000,
    })
  })

  test('refetches when the tab becomes visible again', async ({ page }) => {
    await gotoReady(page, '/crm')
    await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 15_000 })

    let requestsSinceVisible = 0
    page.on('request', (req) => {
      if (req.url().includes('/api/crm/leads/status-summary')) requestsSinceVisible++
    })

    // jsdom/browsers don't let a real navigation flip visibilityState, so
    // this stubs it directly the same way the app's own listener reads it
    // (document.visibilityState === 'visible') before dispatching the event
    // its handler actually listens for.
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
