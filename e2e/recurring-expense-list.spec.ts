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
    await expect(list(page).locator('tbody tr', { hasText: 'Installation' })).toContainText(
      'Picked each time'
    )
    // The two lines of the client's list that are not expenses are said to be left out.
    await expect(page.getByText(/PCF \/ revolving/)).toBeVisible()
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
      const row = list(page).locator('tbody tr', { hasText: unique })
      await expect(row).toContainText('6-03-010', { timeout: 15_000 })

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
      await list(page).locator('tbody tr', { hasText: unique }).click()
      await expect(page).toHaveURL(/\/edit$/)
      await loaded
      await expect(nameInput(page)).toHaveValue(unique)
      await nameInput(page).fill(renamed)
      await page.getByRole('textbox', { name: 'Expense account' }).click()
      await page.getByRole('button', { name: 'Picked each time' }).click()
      await saveEntry(page)
      await expect(list(page).locator('tbody tr', { hasText: renamed })).toContainText(
        'Picked each time',
        { timeout: 15_000 }
      )
      // Renamed, not copied: no row is left under the old name.
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
        const left = list(page).locator('tbody tr', { hasText: name })
        if (await left.count()) {
          await left.getByRole('button', { name: 'More actions' }).click()
          await page.getByRole('button', { name: 'Delete' }).click()
          await expect(left).toHaveCount(0, { timeout: 15_000 })
          break
        }
      }
    }
    await expect(list(page).locator('tbody tr', { hasText: 'E2E list entry' })).toHaveCount(0)
  })
})
