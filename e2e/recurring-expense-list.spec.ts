/**
 * The Recurring tab under Expenses — the client's "List of Recurring Expenses" (rental,
 * electricity, water, fuel…) kept as editable data: a name and the account it is filed
 * under. Expenses are filed on the Expenses tab; nothing is scheduled or filed from the
 * Recurring tab itself.
 *
 * Adds one entry with a unique name and removes it again; never saves an expense, so
 * nothing else is created. Rules (unique names, usable account, the starting rows) are
 * proven in backend/src/accounting/recurring-expense-types/*.spec.ts.
 */

import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

const RECURRING = '/accounting/expenses/recurring'
const unique = `E2E list entry ${Date.now()}`

/** Opens a page that loads the chart of accounts on mount and waits for that, so the
 * form has hydrated before anything is typed or clicked into it. */
async function openHydrated(page: Page, url: string) {
  const loaded = page.waitForResponse((r) => r.url().includes('/api/accounts'))
  await gotoReady(page, url)
  await loaded
}

const list = (page: Page) => page.getByTestId('recurring-list')
const nameInput = (page: Page) => page.locator('input[aria-label="Recurring expense name"]')
const searchBox = (page: Page) => page.getByLabel('Search recurring expenses')

/** Searches the list. It first waits for the list to have loaded — the "Loading..." row is
 * gone, which also means the page has hydrated — because text typed before hydration is
 * wiped when React takes over. */
async function search(page: Page, text: string) {
  await expect(list(page).getByText('Loading...')).toHaveCount(0, { timeout: 15_000 })
  await searchBox(page).fill(text)
  await expect(searchBox(page)).toHaveValue(text)
}

/** The list pages ten to a page, so an entry past the first page (Installation, or one just
 * added at the end) is found by searching for it. Returns its row. */
async function rowFor(page: Page, text: string) {
  await search(page, text)
  return list(page).locator('tbody tr', { hasText: text })
}

async function saveEntry(page: Page) {
  await expect(async () => {
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${RECURRING}$`), { timeout: 3_000 })
  }).toPass({ timeout: 20_000 })
}

test.describe('Recurring Expenses (the list)', () => {
  test("the Recurring tab is only the client's list, with each one's account", async ({ page }) => {
    await gotoReady(page, '/accounting/expenses')
    await page.getByRole('link', { name: 'Recurring', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${RECURRING}$`))
    await expect(page.getByRole('heading', { name: 'Recurring Expenses' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Add to list' })).toBeVisible()
    // Nothing is filed or scheduled from here — expenses are filed on the Expenses tab.
    await expect(page.getByRole('button', { name: 'Run due now' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /New recurring expense/ })).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: 'Repeats' })).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: 'Next due' })).toHaveCount(0)

    await expect(list(page).getByRole('columnheader', { name: 'Expense' })).toBeVisible()
    await expect(list(page).getByRole('columnheader', { name: 'Account' })).toBeVisible()
    await expect(list(page).locator('tbody tr', { hasText: 'Rental monthly' })).toContainText(
      '6-03-010'
    )
    await expect(list(page).locator('tbody tr', { hasText: 'Electricity bills' })).toContainText(
      '6-03-040'
    )
    // Installation has an account per product, so none is pre-filled.
    await expect(await rowFor(page, 'Installation')).toContainText('Picked each time')
    // No explanatory paragraphs above the list — the heading, search and table only.
    await expect(page.getByText(/PCF \/ revolving/)).toHaveCount(0)
    await expect(page.getByText(/come round again/)).toHaveCount(0)
  })

  test('is searchable by expense or account, and pages ten to a page', async ({ page }) => {
    await gotoReady(page, RECURRING)
    await expect(list(page).locator('tbody tr', { hasText: 'Rental monthly' })).toBeVisible({
      timeout: 15_000,
    })
    const summary = page.getByTestId('recurring-list-summary')
    const next = page.getByRole('button', { name: 'Next', exact: true })
    const previous = page.getByRole('button', { name: 'Previous', exact: true })

    // The starting list has 16 entries: ten on the first page, the rest on the second.
    await expect(summary).toContainText(/Showing 1–10 of \d+ entries/)
    await expect(list(page).locator('tbody tr')).toHaveCount(10)
    await expect(previous).toBeDisabled()
    await expect(async () => {
      await next.click()
      await expect(summary).toContainText(/Showing 11–/, { timeout: 2_000 })
    }).toPass({ timeout: 20_000 })
    await expect(next).toBeDisabled()
    await expect(list(page).locator('tbody tr', { hasText: 'Rental monthly' })).toHaveCount(0)
    await previous.click()
    await expect(summary).toContainText(/Showing 1–10/)

    // By account number: every 6-04-… expense account, wherever it sits in the list.
    await search(page, '6-04')
    await expect(list(page).locator('tbody tr', { hasText: 'Fuel / lubricants' })).toBeVisible()
    await expect(list(page).locator('tbody tr', { hasText: 'Freight' })).toBeVisible()
    await expect(list(page).locator('tbody tr', { hasText: 'Rental monthly' })).toHaveCount(0)

    // By name, case-insensitive; a search that finds nothing says so, and Clear undoes it.
    await search(page, 'ELECTRICITY')
    await expect(list(page).locator('tbody tr', { hasText: 'Electricity bills' })).toBeVisible()
    await search(page, 'zz-no-such-entry-zz')
    await expect(page.getByTestId('recurring-no-match')).toBeVisible()
    await expect(page.getByTestId('recurring-list-summary')).toHaveCount(0)
    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(searchBox(page)).toHaveValue('')
    await expect(summary).toContainText(/Showing 1–10 of \d+ entries/)
  })

  test('an entry can be added, edited and removed', async ({ page }) => {
    const renamed = `${unique} renamed`
    try {
      // ── add ──
      await openHydrated(page, `${RECURRING}/new`)
      await nameInput(page).fill(unique)
      const account = page.getByRole('textbox', { name: 'Expense account' })
      await account.click()
      await account.fill('6-03-010')
      await page.getByRole('button', { name: '6-03-010 — Rent Expense' }).click()
      await saveEntry(page)
      // New entries go to the end of the list, so past the first page: search for it.
      await expect(list(page).locator('tbody tr', { hasText: 'Rental monthly' })).toBeVisible({
        timeout: 15_000,
      })
      await expect(await rowFor(page, unique)).toContainText('6-03-010', { timeout: 15_000 })

      // ── a name already on the list (any case) is refused ──
      await openHydrated(page, `${RECURRING}/new`)
      await nameInput(page).fill(unique.toUpperCase())
      await expect(async () => {
        await page.getByRole('button', { name: 'Save', exact: true }).click()
        await expect(page.getByText(/There is already an entry with this name/)).toBeVisible({
          timeout: 3_000,
        })
      }).toPass({ timeout: 20_000 })
      await expect(page).toHaveURL(/\/recurring\/new$/)

      // ── edit: rename, and clear the account ──
      await gotoReady(page, RECURRING)
      const loaded = page.waitForResponse((r) => r.url().includes('/api/accounts'))
      await (await rowFor(page, unique)).click()
      // Clicking an entry shows what is recorded under it (Docket #55); Edit entry
      // is what opens the form.
      await expect(page.getByTestId('recurring-entry-name')).toHaveText(unique, {
        timeout: 15_000,
      })
      await page.getByRole('link', { name: 'Edit entry' }).click()
      await expect(page).toHaveURL(/\/edit$/)
      await loaded
      await expect(nameInput(page)).toHaveValue(unique)
      await nameInput(page).fill(renamed)
      await page.getByRole('textbox', { name: 'Expense account' }).click()
      await page.getByRole('button', { name: 'Picked each time' }).click()
      await saveEntry(page)
      await expect(list(page).locator('tbody tr', { hasText: 'Rental monthly' })).toBeVisible({
        timeout: 15_000,
      })
      await expect(await rowFor(page, renamed)).toContainText('Picked each time', {
        timeout: 15_000,
      })
      // Renamed, not copied: no row is left under the old name (the search for it also
      // finds the renamed one, which merely contains it).
      await search(page, unique)
      await expect(
        list(page).locator('tbody tr td', { hasText: new RegExp(`^${unique}$`) })
      ).toHaveCount(0)
    } finally {
      // Whatever happened above, leave the list as it was found: take off whichever of
      // the two names is still there. The row menu opens downward, so make room.
      await page.setViewportSize({ width: 1440, height: 1600 })
      await gotoReady(page, RECURRING)
      // The table says "Loading…" until the list arrives — count nothing before then.
      await expect(list(page).locator('tbody tr', { hasText: 'Rental monthly' })).toBeVisible({
        timeout: 15_000,
      })
      page.once('dialog', (d) => void d.accept())
      for (const name of [renamed, unique]) {
        const left = await rowFor(page, name)
        if (await left.count()) {
          await left.getByRole('button', { name: 'More actions' }).click()
          await page.getByRole('button', { name: 'Delete' }).click()
          await expect(left).toHaveCount(0, { timeout: 15_000 })
          break
        }
      }
    }
    await expect(await rowFor(page, 'E2E list entry')).toHaveCount(0)
  })
})
