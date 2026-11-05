import { test, expect, type Page } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

/**
 * Scenario 85 Part 4 — Sales Quotas (/pos/sales-quotas, a tab in POS → Reports).
 *
 * Covers: the grid (branches, Total Branches, AC Unit + Services, Grand
 * Total), saving a cell and reading it back, clearing it, an Excel block
 * pasted across cells, and who can reach the page — the Business Owner
 * only (developer decision 2026-11-05): an Accountant gets 403, and a
 * Branch Manager (whose pos:*:* would otherwise match) gets neither the tab
 * nor the page.
 *
 * Save/round-trip rules, scoping and validation are covered by
 * backend/test/sales-quotas.e2e-spec.ts. Self-cleaning: works on next year
 * and clears every cell it sets.
 */

const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'
const NEXT_YEAR = String(new Date().getFullYear() + 1)

async function openYear(page: Page, year: string): Promise<void> {
  await gotoReady(page, '/pos/sales-quotas')
  await expect(page.getByRole('heading', { name: 'Sales Quotas' })).toBeVisible({
    timeout: 15_000,
  })
  const picker = page.getByLabel('Year', { exact: true })
  await expect(async () => {
    await picker.click()
    await picker.fill(year)
    await page
      .getByTestId('searchable-select-option')
      .filter({ hasText: new RegExp(`^${year}$`) })
      .click({ timeout: 3_000 })
  }).toPass({ timeout: 20_000 })
  await expect(page.getByText(`${year} quotas — no unsaved changes`)).toBeVisible({
    timeout: 20_000,
  })
}

/** The first branch row's Jan input (first row of the grid). */
function firstCell(page: Page, month = 'Jan') {
  return page
    .locator('tbody tr')
    .first()
    .getByLabel(new RegExp(` ${month}$`))
}

/** A MoneyInput shows its value grouped ("1,400,000"), so fillStable's
 * exact-value check never matches; same retry, checked against the display. */
async function fillMoney(
  cell: ReturnType<typeof firstCell>,
  value: string,
  shown: string
): Promise<void> {
  await expect(async () => {
    await cell.fill(value)
    await expect(cell).toHaveValue(shown, { timeout: 1_000 })
  }).toPass({ timeout: 10_000 })
}

async function saveAndWait(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Save quotas' }).click()
  await expect(page.getByText(/no unsaved changes/)).toBeVisible({ timeout: 20_000 })
}

test.describe('POS — Sales Quotas (Scenario 85 Part 4)', () => {
  test('lists branches, both total rows and the AC Unit + Services line', async ({ page }) => {
    await openYear(page, NEXT_YEAR)
    await expect(page.getByRole('rowheader', { name: 'Total Branches' })).toBeVisible()
    await expect(page.getByRole('rowheader', { name: 'AC Unit + Services' })).toBeVisible()
    await expect(page.getByRole('rowheader', { name: 'Grand Total' })).toBeVisible()
    for (const month of ['Jan', 'Jun', 'Dec']) {
      await expect(page.getByRole('columnheader', { name: month, exact: true })).toBeVisible()
    }
  })

  test('saves a quota, reads it back after reload, then clears it', async ({ page }) => {
    await openYear(page, NEXT_YEAR)
    await fillMoney(firstCell(page), '1400000', '1,400,000')
    await expect(page.getByText('1 unsaved change')).toBeVisible()
    await saveAndWait(page)

    await openYear(page, NEXT_YEAR)
    await expect(firstCell(page)).toHaveValue('1,400,000')
    // Total Branches carries it too.
    const totals = page.getByRole('row', { name: /^Total Branches/ })
    await expect(totals).toContainText('1,400,000')

    await fillMoney(firstCell(page), '', '')
    await saveAndWait(page)
    await openYear(page, NEXT_YEAR)
    await expect(firstCell(page)).toHaveValue('')
  })

  test('pastes a block copied from Excel across months, then discards it', async ({ page }) => {
    await openYear(page, NEXT_YEAR)
    const cell = firstCell(page)
    await cell.click()
    await cell.evaluate((el) => {
      const data = new DataTransfer()
      data.setData('text/plain', '1,000,000\t2,000,000\t3,000,000\n')
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }))
    })
    await expect(firstCell(page, 'Jan')).toHaveValue('1,000,000')
    await expect(firstCell(page, 'Feb')).toHaveValue('2,000,000')
    await expect(firstCell(page, 'Mar')).toHaveValue('3,000,000')
    await expect(page.getByText('3 unsaved changes')).toBeVisible()

    await page.getByRole('button', { name: 'Discard changes' }).click()
    await expect(firstCell(page, 'Feb')).toHaveValue('')
  })

  test('shows as a tab in the POS Reports hub', async ({ page }) => {
    await gotoReady(page, '/pos/reports')
    await page.getByRole('link', { name: 'Sales Quotas' }).first().click()
    await expect(page).toHaveURL(/\/pos\/sales-quotas/, { timeout: 15_000 })
  })

  test.describe('who can reach it', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('an Accountant gets a 403', async ({ page }) => {
      await loginAs(page, 'technova.accounting@test.com', PASSWORD)
      await gotoReady(page, '/pos/sales-quotas')
      await expect(page).toHaveURL(/\/403/, { timeout: 15_000 })
    })

    test('a Branch Manager gets neither the tab nor the page', async ({ page }) => {
      await loginAs(page, 'technova.b1.manager@test.com', PASSWORD)
      await gotoReady(page, '/pos/reports')
      await expect(page.getByRole('heading', { name: 'Sales Reports' })).toBeVisible({
        timeout: 15_000,
      })
      await expect(page.getByRole('link', { name: 'Sales Quotas' })).toHaveCount(0)

      await gotoReady(page, '/pos/sales-quotas')
      await expect(page).toHaveURL(/\/403/, { timeout: 15_000 })
    })
  })
})
