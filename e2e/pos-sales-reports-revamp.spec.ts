import { test, expect, type Page } from '@playwright/test'
import { fillStable, gotoReady } from './utils'

/**
 * Scenario 85 — revamped Sales Reports (/pos/reports). Part 1: tabs, the
 * shared filter bar and the four stat cards. Part 2: the Sales Report tab
 * (paged units, totals, Export to Excel).
 *
 * Exact figures (gross at LCP, refunds netted, Office vs Agent, each filter,
 * branch scoping) are covered by backend/test/sales-reports-revamp.e2e-spec.ts,
 * which controls sale amounts directly. This spec covers the UI wiring: the
 * filters are shared by every tab, a link's query string opens that view,
 * and the stat cards render from the summary endpoint.
 *
 * Runs as Business Owner (the chromium project's stored auth state).
 * Replaces pos-sales-reports.spec.ts / pos-sales-report-margin.spec.ts, which
 * covered the Sales per Branch / per Brand tables this page no longer has.
 */

async function open(page: Page, query = ''): Promise<void> {
  await gotoReady(page, `/pos/reports${query}`)
  await expect(page.getByRole('heading', { name: 'Sales Reports' })).toBeVisible({
    timeout: 15_000,
  })
  // The stat cards fill in only once the page has hydrated and queried; a
  // date typed before then is overwritten when React takes the input over.
  await expect(page.getByText('…', { exact: true })).toHaveCount(0, { timeout: 20_000 })
}

async function pick(page: Page, label: string, option: string): Promise<void> {
  const input = page.getByLabel(label, { exact: true })
  await expect(async () => {
    await input.click()
    await input.fill(option)
    await page
      .getByTestId('searchable-select-option')
      .filter({ hasText: new RegExp(`^${option}$`) })
      .click({ timeout: 3_000 })
  }).toPass({ timeout: 20_000 })
}

test.describe('POS — Sales Reports revamp (Scenario 85)', () => {
  test('shows three tabs, Dashboard first, and the four stat cards', async ({ page }) => {
    await open(page)

    await expect(
      page.getByText('Units and sales by model and brand, month by month.')
    ).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Dashboard' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(page.getByRole('tab', { name: 'Sales per Branch' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Sales Report' })).toBeVisible()

    for (const label of [
      'Total Sales (gross)',
      'Office Sales',
      'Agent Sales',
      'Total Quantity Sold',
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible()
    }
    // Figures come back from the summary endpoint (0.00 on an empty test DB).
    await expect(page.getByText('…', { exact: true })).toHaveCount(0, { timeout: 20_000 })
    await expect(page.getByText('Could not load sales')).toHaveCount(0)
  })

  test('shows every filter, defaulting to twelve months to date', async ({ page }) => {
    await open(page)

    for (const label of ['From', 'To', 'Region', 'Branch', 'Type', 'Group', 'Brand']) {
      await expect(page.getByLabel(label, { exact: true })).toBeVisible()
    }
    const from = await page.getByLabel('From', { exact: true }).inputValue()
    const to = await page.getByLabel('To', { exact: true }).inputValue()
    expect(from.endsWith('-01')).toBe(true)
    const months =
      (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
      Number(to.slice(5, 7)) -
      Number(from.slice(5, 7))
    expect(months).toBe(11)
  })

  test('keeps the filters when switching tabs', async ({ page }) => {
    await open(page)

    await fillStable(page.getByLabel('From', { exact: true }), '2026-01-01')
    await pick(page, 'Region', 'Negros')
    await page.getByRole('tab', { name: 'Sales Report' }).click()
    await page.getByRole('tab', { name: 'Dashboard' }).click()

    await expect(page.getByRole('tab', { name: 'Dashboard' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(page.getByLabel('From', { exact: true })).toHaveValue('2026-01-01')
    await expect(page.getByLabel('Region', { exact: true })).toHaveValue('Negros')
  })

  test("opens on a link's tab and filters", async ({ page }) => {
    await open(page, '?tab=report&region=negros&from=2026-02-01&to=2026-02-28')

    await expect(page.getByRole('tab', { name: 'Sales Report' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(page.getByLabel('From', { exact: true })).toHaveValue('2026-02-01')
    await expect(page.getByLabel('Region', { exact: true })).toHaveValue('Negros')
  })

  test('Clear filters resets the dropdowns but keeps the date range', async ({ page }) => {
    await open(page, '?region=panay&from=2026-02-01&to=2026-02-28')

    await expect(page.getByLabel('Region', { exact: true })).toHaveValue('Panay')
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.getByLabel('Region', { exact: true })).toHaveValue('')
    await expect(page.getByLabel('From', { exact: true })).toHaveValue('2026-02-01')
    await expect(page.getByRole('button', { name: 'Clear filters' })).toHaveCount(0)
  })

  test.describe('Sales Report tab (Part 2)', () => {
    const HEADERS = [
      'Date',
      'Month',
      'Invoice Type',
      'Classification',
      'Branch',
      'SI No.',
      'Firstname',
      'Lastname',
      'Type',
      'Group',
      'Subgroup',
      'Brand',
      'Model No.',
      'Serial No.',
      'Qty',
      'LCP',
      'Unit Cost',
      'Price Used',
      'Agent',
      'Commission',
    ]

    test("lists the client's columns, with totals matching the stat cards", async ({ page }) => {
      await open(page, '?tab=report')
      await expect(page.getByRole('heading', { name: 'Sales Report', level: 2 })).toBeVisible()
      for (const header of HEADERS) {
        await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible()
      }
      await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 20_000 })

      // The tab's Total Sales and the stat card are the same figure — read
      // once both queries have settled (neither shows the '…' placeholder).
      const card = page.getByText('Total Sales (gross)', { exact: true })
      await expect(card).toHaveCount(2)
      const values = (): Promise<(string | undefined)[]> =>
        card.evaluateAll((els) => els.map((el) => el.nextElementSibling?.textContent?.trim()))
      await expect.poll(async () => (await values()).includes('…'), { timeout: 20_000 }).toBe(false)
      const [statCard, tabTotal] = await values()
      expect(tabTotal).toBe(statCard)
    })

    test('Export to Excel downloads a real .xlsx', async ({ page }) => {
      await open(page, '?tab=report')
      const exportButton = page.getByRole('button', { name: /Export to Excel/ })
      await expect(exportButton).toBeVisible()
      await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 20_000 })
      await expect(page.getByText('…', { exact: true })).toHaveCount(0, { timeout: 20_000 })

      if (await exportButton.isDisabled()) {
        await expect(page.getByText('No sales for these filters.')).toBeVisible()
        test.info().annotations.push({
          type: 'skipped-assertion',
          description: 'No sales in range — download path not exercised.',
        })
        return
      }

      const downloadPromise = page.waitForEvent('download', { timeout: 60_000 })
      await exportButton.click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toMatch(/sales-report.*\.xlsx$/)
      const { readFileSync } = await import('fs')
      expect(
        readFileSync(await download.path())
          .subarray(0, 2)
          .toString()
      ).toBe('PK')
    })

    test('Export to Excel only shows on the Sales Report tab for now', async ({ page }) => {
      await open(page)
      await expect(page.getByRole('button', { name: /Export to Excel/ })).toHaveCount(0)
    })
  })
})
