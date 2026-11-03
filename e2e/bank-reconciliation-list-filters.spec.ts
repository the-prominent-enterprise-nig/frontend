import { test, expect, type Page } from '@playwright/test'
import { fillStable, gotoReady } from './utils'

// The Bank Reconciliation list can run to dozens of rows (one per bank per
// statement date), so it can be searched and filtered. Filtering is read-only,
// so these tests work with whatever reconciliations already exist.

const rows = (page: Page) => page.locator('table').first().locator('tbody tr')
const accountOf = (row: ReturnType<typeof rows>) => row.locator('td').first()
const statusOf = (row: ReturnType<typeof rows>) => row.locator('td').nth(5)

async function openList(page: Page) {
  await gotoReady(page, '/accounting/bank-reconciliation')
  await expect(page.getByRole('heading', { name: 'Bank Reconciliation' })).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByText('Loading...').first()).toHaveCount(0, { timeout: 30_000 })
}

test.describe('Accounting — Bank Reconciliation list search and filters', () => {
  test('searching by account name narrows the list, and clearing brings it back', async ({
    page,
  }) => {
    await openList(page)
    const all = await rows(page).count()
    test.skip(all < 2, 'needs at least two reconciliations')

    // Search on the first word of the first account, so it matches by name only.
    const firstName = (await accountOf(rows(page).first()).innerText()).trim()
    const term = firstName.split(/\s+/)[0]
    await fillStable(page.getByPlaceholder('Bank account'), term.toUpperCase())

    const shown = await rows(page).count()
    expect(shown).toBeGreaterThan(0)
    expect(shown).toBeLessThanOrEqual(all)
    for (let i = 0; i < shown; i++) {
      await expect(accountOf(rows(page).nth(i))).toContainText(new RegExp(term, 'i'))
    }

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(rows(page)).toHaveCount(all)
    await expect(page.getByPlaceholder('Bank account')).toHaveValue('')
    await expect(page.getByRole('button', { name: 'Clear filters' })).toHaveCount(0)
  })

  test('the status filter can be searched and takes more than one status', async ({ page }) => {
    await openList(page)
    const all = await rows(page).count()
    const statuses: string[] = []
    for (let i = 0; i < all; i++) {
      statuses.push((await statusOf(rows(page).nth(i)).innerText()).trim())
    }
    const distinct = [...new Set(statuses)]
    test.skip(distinct.length < 2, 'needs at least two different statuses')
    const [a, b] = distinct

    const box = page.getByRole('textbox', { name: 'Status' })
    // Typing narrows the list of statuses to the ones that match.
    await box.click()
    await box.fill(a.slice(0, 3).toLowerCase())
    await expect(page.getByRole('checkbox', { name: a })).toBeVisible()
    await expect(page.getByRole('checkbox')).not.toHaveCount(4)

    // One status: only its rows.
    await page.getByRole('checkbox', { name: a }).click()
    const justA = statuses.filter((x) => x === a).length
    await expect(rows(page)).toHaveCount(justA)
    for (let i = 0; i < justA; i++) {
      await expect(statusOf(rows(page).nth(i))).toHaveText(a)
    }

    // A second one ticked as well: the rows of either, and only those.
    await box.fill('')
    await page.getByRole('checkbox', { name: b }).click()
    await expect(rows(page)).toHaveCount(statuses.filter((x) => x === a || x === b).length)
    for (let i = 0; i < (await rows(page).count()); i++) {
      await expect(statusOf(rows(page).nth(i))).toHaveText(new RegExp(`^(${a}|${b})$`))
    }

    // Unticking one leaves the other.
    await page.getByRole('checkbox', { name: a }).click()
    await expect(rows(page)).toHaveCount(statuses.filter((x) => x === b).length)
  })

  test('a search that matches nothing says so, rather than "No reconciliations."', async ({
    page,
  }) => {
    await openList(page)
    await fillStable(page.getByPlaceholder('Bank account'), 'zzz-no-such-bank')
    await expect(page.getByText('No reconciliations match these filters.')).toBeVisible()
    await expect(page.getByText('No reconciliations.', { exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.getByText('No reconciliations match these filters.')).toHaveCount(0)
  })

  test('the statement date range keeps only reconciliations inside it', async ({ page }) => {
    await openList(page)
    const all = await rows(page).count()
    test.skip(all < 1, 'needs at least one reconciliation')

    // Nothing is dated on or after 2099-01-01.
    await fillStable(page.getByLabel('Statement From'), '2099-01-01')
    await expect(page.getByText('No reconciliations match these filters.')).toBeVisible()

    // Nothing is dated before 2000-01-01 either, so a window from there on to
    // 2099 shows them all again.
    await fillStable(page.getByLabel('Statement From'), '2000-01-01')
    await fillStable(page.getByLabel('Statement To'), '2099-12-31')
    await expect(rows(page)).toHaveCount(all)

    // An end date before every statement date empties it.
    await fillStable(page.getByLabel('Statement To'), '1999-12-31')
    await expect(page.getByText('No reconciliations match these filters.')).toBeVisible()
  })
})
