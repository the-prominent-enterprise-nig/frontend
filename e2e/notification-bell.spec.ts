import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 26, Part 4 — replaces TopBar.tsx's hardcoded fake bell
// (useState(6), no data) with a real one wired to the backend. No trigger
// wiring exists yet (Part 5/6), so this only proves the UI shell renders
// and behaves correctly against a real, empty backend — not real data.

test('notification bell renders, shows zero unread, and opens an empty panel', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  await gotoReady(page, '/')

  const bell = page.getByRole('button', { name: 'Notifications' })
  await expect(bell).toBeVisible()

  // No unread badge (0 count) — the fake bell always showed "6" regardless
  // of real data; this one shows nothing when there's genuinely nothing.
  await expect(bell.locator('span')).toHaveCount(0)

  await bell.click()
  await expect(page.getByText('No notifications yet')).toBeVisible()
  await expect(page.getByText('Notifications', { exact: true })).toBeVisible()
  // Mark-all-as-read only renders when there's something unread to clear.
  await expect(page.getByRole('button', { name: 'Mark all as read' })).toHaveCount(0)

  // Clicking the backdrop closes the panel.
  await page.mouse.click(10, 10)
  await expect(page.getByText('No notifications yet')).not.toBeVisible()

  const relevantErrors = consoleErrors.filter((e) => /notification/i.test(e))
  expect(relevantErrors).toEqual([])
})
