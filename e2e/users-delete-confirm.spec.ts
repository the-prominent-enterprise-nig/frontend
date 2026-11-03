import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

// Settings › Users: Delete and Deactivate ask first. They used to act on the
// first click (Delete did nothing at all). Cancelling sends nothing.

async function openFirstRowMenu(page: Page): Promise<void> {
  await gotoReady(page, '/settings/users?status=active')
  const menu = page.locator('tbody tr td:last-child button').first()
  await menu.waitFor()
  await menu.click()
}

test.describe('Users: delete and deactivate ask first', () => {
  for (const action of ['Delete', 'Deactivate'] as const) {
    test(`${action} shows a confirmation, and Cancel changes nothing`, async ({ page }) => {
      const writes: string[] = []
      page.on('request', (req) => {
        if (['DELETE', 'PATCH'].includes(req.method()) && req.url().includes('/users/')) {
          writes.push(`${req.method()} ${req.url()}`)
        }
      })
      await openFirstRowMenu(page)
      await page.getByRole('button', { name: action, exact: true }).click()

      await expect(page.getByRole('heading', { name: `${action} user?` })).toBeVisible()
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByRole('heading', { name: `${action} user?` })).toHaveCount(0)
      expect(writes).toEqual([])
    })
  }
})
