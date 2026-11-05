import { test, expect, type Page } from '@playwright/test'
import { fillStable, gotoReady, loginAs } from './utils'

/**
 * Scenario 85 — revamped Sales Reports (/pos/reports). Part 1: tabs, the
 * shared filter bar and the four stat cards. Part 2: the Sales Report tab
 * (paged units, totals, Export to Excel). Part 3: the Dashboard tab.
 * Part 5: Sales per Branch → Branch Scorecard. Part 6: → Daily Sales Monitoring.
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

  test.describe('Dashboard tab (Part 3)', () => {
    test('shows the two bar panels and the two month tables', async ({ page }) => {
      await open(page)
      for (const title of [
        'Top models',
        'Units by brand',
        'Top models by month',
        'Brands by month',
      ]) {
        await expect(page.getByRole('region', { name: title, exact: true })).toBeVisible()
      }
      await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 20_000 })

      const table = page.getByRole('region', { name: 'Top models by month', exact: true })
      // Twelve month columns for the default range, plus #, Model, Brand, Total.
      await expect(table.getByRole('columnheader')).toHaveCount(16)
      if (await table.getByText('No sales for these filters.').isVisible()) {
        test.info().annotations.push({
          type: 'skipped-assertion',
          description: 'No sales in range — bars and Grand total not exercised.',
        })
        return
      }
      await expect(table.getByText('Grand total')).toBeVisible()
      const bars = page.getByRole('region', { name: 'Top models', exact: true })
      expect(await bars.getByRole('listitem').count()).toBeLessThanOrEqual(10)
    })

    test('Show all lifts the top-10 cut on a month table', async ({ page }) => {
      await open(page)
      const table = page.getByRole('region', { name: 'Top models by month', exact: true })
      await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 20_000 })
      const showAll = table.getByRole('button', { name: /^Show all \d+$/ })
      if (!(await showAll.isVisible())) {
        test.info().annotations.push({
          type: 'skipped-assertion',
          description: 'Ten or fewer models in range — nothing to expand.',
        })
        return
      }
      const total = Number((await showAll.textContent())!.replace(/\D/g, ''))
      await showAll.click()
      await expect(table.locator('tbody tr')).toHaveCount(total, { timeout: 20_000 })
      await table.getByRole('button', { name: 'Show top 10' }).click()
      await expect(table.locator('tbody tr')).toHaveCount(10, { timeout: 20_000 })
    })
  })

  test.describe('Branch Scorecard (Part 5)', () => {
    test("scores the To date's month, with both total rows and the AC line", async ({ page }) => {
      await open(page, '?tab=branch&from=2026-10-01&to=2026-10-31')
      await expect(page.getByRole('tab', { name: 'Branch Scorecard' })).toHaveAttribute(
        'aria-selected',
        'true'
      )
      await expect(page.getByText('OCTOBER 1–31, 2026')).toBeVisible({ timeout: 20_000 })
      await expect(page.getByRole('heading', { name: 'All Operations' })).toBeVisible()
      for (const kpi of [
        'Total Branches (gross)',
        'Ach Rate (month pace 100%)',
        'Ahead of pace or met',
        'BTS (balance to quota)',
      ]) {
        await expect(page.getByText(kpi, { exact: true })).toBeVisible()
      }
      for (const header of [
        'Total Sales',
        'Office Sales',
        '% Office',
        'Quota',
        'Ach Rate',
        'BTS',
        'Status',
      ]) {
        await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible()
      }
      await expect(page.getByRole('button', { name: 'AC Unit + Services' })).toBeVisible()
      await expect(page.getByRole('rowheader', { name: 'Total Branches' })).toBeVisible()
      await expect(page.getByRole('rowheader', { name: 'Grand Total' })).toBeVisible()
    })

    test('opens a branch to its day-by-day sales', async ({ page }) => {
      await open(page, '?tab=branch&from=2026-10-01&to=2026-10-10')
      const first = page.locator('tbody tr').first().getByRole('button')
      await expect(first).toBeVisible({ timeout: 20_000 })
      const name = (await first.textContent())!.trim()
      await first.click()
      await expect(first).toHaveAttribute('aria-expanded', 'true')
      await expect(
        page.getByText(`${name} — daily sales, office sales under each day`)
      ).toBeVisible()
      await first.click()
      await expect(page.getByText(/daily sales, office sales under each day/)).toHaveCount(0)
    })

    test('titles the scorecard after the chosen region', async ({ page }) => {
      await open(page, '?tab=branch&region=negros')
      await expect(page.getByRole('heading', { name: 'Negros Operations' })).toBeVisible({
        timeout: 20_000,
      })
    })
  })

  test.describe('Daily Sales Monitoring (Part 6)', () => {
    async function openSheet(page: Page, query: string): Promise<void> {
      await open(page, query)
      await page.getByRole('tab', { name: 'Daily Sales Monitoring' }).click()
      await expect(page.getByText('Week 1 (1–8)')).toBeVisible({ timeout: 20_000 })
    }

    test('splits the month into 8-day weeks, then month-to-date rows', async ({ page }) => {
      await openSheet(page, '?tab=branch&from=2026-10-01&to=2026-10-31')
      for (const week of ['Week 1 (1–8)', 'Week 2 (9–16)', 'Week 3 (17–24)', 'Week 4 (25–31)']) {
        await expect(page.getByRole('button', { name: week })).toBeVisible()
      }
      for (const row of [
        'WEEK 1–4',
        '% OFFICE SALES',
        'QUOTA',
        'ACH RATE',
        'BTS (Balance total sales)',
      ]) {
        await expect(page.getByRole('rowheader', { name: row, exact: true })).toBeVisible()
      }
      await expect(page.getByRole('columnheader', { name: 'AC UNIT + SERVICES' })).toBeVisible()
    })

    test('collapses one week, then every week', async ({ page }) => {
      await openSheet(page, '?tab=branch&from=2026-10-01&to=2026-10-31')
      const day1 = page.getByRole('rowheader', { name: '1', exact: true })
      await expect(day1).toBeVisible()
      await page.getByRole('button', { name: 'Week 1 (1–8)' }).click()
      await expect(day1).toHaveCount(0)

      await page.getByRole('button', { name: 'Hide all weeks' }).click()
      await expect(page.getByRole('rowheader', { name: '9', exact: true })).toHaveCount(0)
      await page.getByRole('button', { name: 'Show all weeks' }).click()
      await expect(day1).toBeVisible()
    })

    test("compares with last year's sales when the system holds them", async ({ page }) => {
      // From October 2027, October 2026 is "last year".
      await openSheet(page, '?tab=branch&from=2027-10-01&to=2027-10-09')
      await expect(page.getByText('Week 2 (9–9)')).toBeVisible()
      const footer = page.getByText('October 2026 Sales')
      if (!(await footer.isVisible())) {
        test.info().annotations.push({
          type: 'skipped-assertion',
          description: 'No October 2026 sales in this database — footer not exercised.',
        })
        return
      }
      await expect(page.getByText('January–December 2026 Sales')).toBeVisible()
    })
  })

  test.describe('as a Branch Manager', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('names their branch instead of offering Region and Branch filters', async ({ page }) => {
      await loginAs(
        page,
        'technova.b1.manager@test.com',
        process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'
      )
      await open(page)

      await expect(page.getByLabel('Region', { exact: true })).toHaveCount(0)
      await expect(page.getByLabel('Branch', { exact: true })).toHaveCount(0)
      await expect(page.getByText('Bago', { exact: true })).toBeVisible()
      for (const label of ['Type', 'Group', 'Brand']) {
        await expect(page.getByLabel(label, { exact: true })).toBeVisible()
      }
    })

    test('sees a scorecard of their own branch, without the AC Unit + Services line', async ({
      page,
    }) => {
      await loginAs(
        page,
        'technova.b1.manager@test.com',
        process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'
      )
      await open(page, '?tab=branch')
      await expect(page.getByRole('heading', { name: 'Bago' })).toBeVisible({ timeout: 20_000 })
      await expect(page.locator('tbody tr')).toHaveCount(1)
      await expect(page.getByRole('button', { name: 'AC Unit + Services' })).toHaveCount(0)
    })
  })
})
