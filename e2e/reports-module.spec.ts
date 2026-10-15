/**
 * The Reports module — the financial reports hub and the Data Query Center,
 * moved out of Accounting into their own module listed right after CRM.
 *
 * Read-only: it checks where the screens live (the sidebar, the new URLs, the
 * old URLs redirecting) and that the Data Query Center's results keep
 * refreshing on their own. Nothing is written to the database.
 */
import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

test.describe('Reports module', () => {
  test('is listed right after CRM and holds Reports and Data Query Center', async ({ page }) => {
    await gotoReady(page, '/reports')
    const nav = page.getByRole('complementary')
    const labels = await nav.getByRole('link').allInnerTexts()
    const names = labels.map((l) => l.trim())
    expect(names.indexOf('Reports')).toBe(names.indexOf('CRM') + 1)
    await expect(nav.getByRole('link', { name: 'Data Query Center' })).toBeVisible()
  })

  test('the old Accounting URLs redirect to the new ones', async ({ page }) => {
    await page.goto('/accounting/reports?tab=trial-balance')
    await expect(page).toHaveURL(/\/reports\?tab=trial-balance$/)
    await page.goto('/accounting/query-center')
    await expect(page).toHaveURL(/\/reports\/query-center$/)
  })

  test('Data Query Center results refresh on their own while live', async ({ page }) => {
    test.setTimeout(90_000)
    await gotoReady(page, '/reports/query-center')

    const search = page.getByPlaceholder(/Search \d* ?datasets…/)
    await expect(search).toBeVisible({ timeout: 20_000 })
    await search.fill('Customer')
    await page
      .getByRole('button', { name: /Customer/ })
      .first()
      .click()
    await page.getByRole('button', { name: 'Run query' }).click()

    const badge = page.getByTestId('query-live')
    await expect(badge).toContainText('Live')
    await expect(badge).toContainText('updated', { timeout: 20_000 })
    // Picking a dataset already runs it, so let the Run click's own update
    // land first: what changes after this is the timer's doing.
    await page.waitForLoadState('networkidle')
    const before = (await badge.innerText()).match(/updated (.+)/)![1]
    const since = Date.now()

    // No click this time: the 15s live timer re-runs the query by itself and
    // moves the "updated" time on.
    await expect(badge).not.toContainText(`updated ${before}`, { timeout: 30_000 })
    expect(Date.now() - since).toBeGreaterThan(8_000)

    await badge.getByRole('button', { name: 'Pause live updates' }).click()
    await expect(badge).toContainText('Paused')
  })
})
