import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// UAT 2026-10-29 §6: "Switch the Origin and Location columns." The Serial
// Number Locator (and the General Stockbook, which shares the table) reads
// Origin, then Location, then Destination: where the unit came from, where it
// is, where it went. Business Owner (the default storage state); a wide window
// so every responsive column is shown.

test.use({ viewport: { width: 1600, height: 1000 } })

test('Serial Number Locator shows Origin before Location, then Destination', async ({ page }) => {
  await gotoReady(page, '/inventory/stock?tab=locator')
  const headers = page.locator('thead th')
  await expect(headers.filter({ hasText: /Origin/i })).toHaveCount(1, { timeout: 30_000 })

  const labels = (await headers.allInnerTexts()).map((h) => h.replace(/\s+/g, ' ').trim())
  const at = (name: RegExp): number => labels.findIndex((h) => name.test(h))
  const origin = at(/^Origin/i)
  const location = at(/^Location/i)
  const destination = at(/^Destination/i)

  expect(origin).toBeGreaterThanOrEqual(0)
  expect(origin).toBeLessThan(location)
  expect(location).toBeLessThan(destination)
})
