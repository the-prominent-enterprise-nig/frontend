import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

// Sidebar search — type a page's name, pick it. Built from the same navigation
// and permissions as the sidebar itself, so it only ever offers pages the
// signed-in user could open from the menu (the seeded Business Owner here, who
// can open them all).

const search = (page: Page) => page.getByLabel('Search pages')
const options = (page: Page) => page.locator('#sidebar-search-results [role=option]')

/** Types into the search, retried as a unit: a keystroke that lands before
 * hydration reaches nothing. */
async function typeQuery(page: Page, query: string, expected: RegExp | null) {
  await expect(async () => {
    await search(page).fill('')
    await search(page).fill(query)
    if (expected) await expect(options(page).first()).toContainText(expected, { timeout: 1_500 })
    else await expect(page.locator('#sidebar-search-results')).toBeVisible({ timeout: 1_500 })
  }).toPass({ timeout: 20_000 })
}

test.describe('Sidebar search', () => {
  test.beforeEach(async ({ page }) => {
    await gotoReady(page, '/dashboard')
    await expect(search(page)).toBeVisible({ timeout: 30_000 })
  })

  test('SS-F01: typing a page name lists it with where it lives, and Enter opens it', async ({
    page,
  }) => {
    await typeQuery(page, 'journal', /Journal Entries/)
    await expect(options(page).first()).toContainText('Accounting › Books')

    await search(page).press('Enter')
    await expect(page).toHaveURL(/\/accounting\//, { timeout: 30_000 })
    // It lets go of the box once it has taken you there.
    await expect(search(page)).toHaveValue('')
  })

  test('SS-F02: it finds the tabs inside a hub, not only the sidebar rows', async ({ page }) => {
    // "AR Invoices" is a tab of Receivables — the sidebar has only the one row.
    await typeQuery(page, 'ar inv', /AR Invoices/)
    await expect(options(page).first()).toContainText('Accounting › Receivables')
  })

  test('SS-F03: every word typed has to match, and a miss says so', async ({ page }) => {
    await typeQuery(page, 'zzzz', null)
    await expect(page.locator('#sidebar-search-results')).toContainText('No pages match')
  })

  test('SS-F04: arrow keys move through the results, Escape clears, Ctrl+K comes back to it', async ({
    page,
  }) => {
    await typeQuery(page, 'collect', /Collect/)
    await expect(options(page).first()).toHaveAttribute('aria-selected', 'true')
    await search(page).press('ArrowDown')
    await expect(options(page).nth(1)).toHaveAttribute('aria-selected', 'true')

    await search(page).press('Escape')
    await expect(search(page)).toHaveValue('')
    await expect(options(page)).toHaveCount(0)

    await page.locator('h1, h2').first().click()
    await page.keyboard.press('Control+k')
    await expect(search(page)).toBeFocused()
  })

  test('SS-F05: on a collapsed sidebar the search is one icon that opens the sidebar and focuses it', async ({
    page,
  }) => {
    await page.getByLabel('Collapse sidebar').click()
    await expect(search(page)).toHaveCount(0)
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(search(page)).toBeVisible()
    await expect(search(page)).toBeFocused()
  })
})
