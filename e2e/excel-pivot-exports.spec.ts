import { test, expect, type Page, type Request } from '@playwright/test'
import { readFileSync } from 'fs'
import { gotoReady } from './utils'

/**
 * Excel pivot-table exports — the Export to Excel button on every report
 * screen downloads a real .xlsx, with the screen's own filters.
 *
 * What's inside the file (every sheet, every pivot, row counts matching the
 * screen) is covered by backend/test/excel-pivot-exports.e2e-spec.ts; this
 * covers the part only a browser can: the button is there on each screen,
 * the click really downloads, and the request carries what's on screen.
 *
 * An .xlsx is a zip, and a zip's central directory stores part names
 * uncompressed — so "does this file contain a pivot table" is a byte search
 * for `xl/pivotTables/`, no unzip library needed.
 *
 * Runs as Business Owner (the chromium project's stored auth state).
 */

const EXPORT = /Export to Excel/

async function downloadFrom(
  page: Page,
  filename: RegExp
): Promise<{ bytes: Buffer; request: Request }> {
  const requestPromise = page.waitForRequest(
    (r) => r.url().includes('/api/') && r.url().includes('/export'),
    { timeout: 30_000 }
  )
  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 })
  await page.getByRole('button', { name: EXPORT }).click()
  const [request, download] = await Promise.all([requestPromise, downloadPromise])

  expect(download.suggestedFilename()).toMatch(filename)
  const bytes = readFileSync(await download.path())
  // Zip magic bytes — a real workbook, not an error page saved as .xlsx.
  expect(bytes.subarray(0, 2).toString()).toBe('PK')
  return { bytes, request }
}

function hasPivot(bytes: Buffer): boolean {
  return bytes.includes('xl/pivotTables/pivotTable1.xml')
}

function params(request: Request): URLSearchParams {
  return new URL(request.url()).searchParams
}

test.describe('Excel pivot exports — Accounting Reports hub', () => {
  // Tabs whose report the test DB always has rows for, so the file must
  // carry a pivot; the rest (AP aging, GRNI, cost center) can legitimately
  // be empty there and are only checked for a valid download.
  const tabs: { tab: string; filename: RegExp; pivot: boolean }[] = [
    { tab: 'trial-balance', filename: /trial-balance.*\.xlsx$/, pivot: true },
    { tab: 'pnl', filename: /profit-and-loss.*\.xlsx$/, pivot: true },
    { tab: 'balance-sheet', filename: /balance-sheet.*\.xlsx$/, pivot: true },
    { tab: 'cash-flow', filename: /cash-flow.*\.xlsx$/, pivot: true },
    { tab: 'ap-aging', filename: /ap-aging.*\.xlsx$/, pivot: false },
    { tab: 'grni', filename: /grni.*\.xlsx$/, pivot: false },
    { tab: 'cost-center', filename: /cost-center.*\.xlsx$/, pivot: false },
  ]

  for (const { tab, filename, pivot } of tabs) {
    test(`${tab}: Export to Excel downloads the report`, async ({ page }) => {
      await gotoReady(page, `/accounting/reports?tab=${tab}`)
      await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({
        timeout: 15_000,
      })
      const { bytes } = await downloadFrom(page, filename)
      if (pivot) expect(hasPivot(bytes)).toBe(true)
    })
  }

  test('P&L export carries the branch and view picked on screen', async ({ page }) => {
    await gotoReady(page, '/accounting/reports?tab=pnl')
    const branch = page.getByLabel('Branch', { exact: true })
    await expect(branch).toBeVisible({ timeout: 15_000 })
    // The first real branch — option 0 is "All Branches".
    await expect(branch.locator('option')).not.toHaveCount(1, { timeout: 15_000 })
    const branchId = await branch.locator('option').nth(1).getAttribute('value')
    await branch.selectOption(branchId!)
    await page.getByLabel('View', { exact: true }).selectOption('internal')

    const { request } = await downloadFrom(page, /profit-and-loss.*\.xlsx$/)
    const q = params(request)
    expect(q.get('branchId')).toBe(branchId)
    expect(q.get('view')).toBe('internal')
    expect(q.get('startDate')).toBeTruthy()
    expect(q.get('endDate')).toBeTruthy()
  })

  test('Customer Statement: no export until a customer is picked', async ({ page }) => {
    await gotoReady(page, '/accounting/reports?tab=customer-statement')
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('button', { name: EXPORT })).toHaveCount(0)

    const picker = page.locator('select').filter({ hasText: 'Select a customer' })
    await expect(picker.locator('option')).not.toHaveCount(1, { timeout: 15_000 })
    const customerId = await picker.locator('option').nth(1).getAttribute('value')
    await picker.selectOption(customerId!)

    const { request } = await downloadFrom(page, /customer-statement.*\.xlsx$/)
    expect(request.url()).toContain(`/reports/customer-statement/${customerId}/export`)
  })

  test('Expenses keeps its own button — the bar does not add a second', async ({ page }) => {
    await gotoReady(page, '/accounting/reports?tab=expenses')
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({
      timeout: 15_000,
    })
    await page.getByRole('button', { name: /Run Report/ }).click()
    await expect(page.getByRole('columnheader', { name: 'Branch' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('button', { name: EXPORT })).toHaveCount(1)
  })

  test('BI Summary has nothing to export', async ({ page }) => {
    await gotoReady(page, '/accounting/reports?tab=bi')
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('button', { name: EXPORT })).toHaveCount(0)
  })
})

test.describe('Excel pivot exports — General Ledger', () => {
  test('exports the lines for the range on screen', async ({ page }) => {
    await gotoReady(page, '/accounting/general-ledger')
    await expect(page.getByRole('heading', { name: 'General Ledger' })).toBeVisible({
      timeout: 15_000,
    })
    const { bytes, request } = await downloadFrom(page, /general-ledger.*\.xlsx$/)
    expect(hasPivot(bytes)).toBe(true)
    expect(params(request).get('startDate')).toBeTruthy()
    // "All accounts" sends no accountId at all.
    expect(params(request).has('accountId')).toBe(false)
  })
})

test.describe('Excel pivot exports — Inventory Reports', () => {
  const reports: { tab: string; filename: RegExp }[] = [
    { tab: 'Stock Valuation', filename: /inventory-valuation.*\.xlsx$/ },
    { tab: 'Turnover', filename: /inventory-turnover.*\.xlsx$/ },
    { tab: 'Aging', filename: /inventory-aging.*\.xlsx$/ },
  ]

  for (const { tab, filename } of reports) {
    test(`${tab}: Excel replaces CSV and exports every row, not one page`, async ({ page }) => {
      await gotoReady(page, '/inventory/reports')
      await page.getByRole('button', { name: tab, exact: true }).click()
      await expect(page.getByRole('button', { name: EXPORT })).toBeEnabled({
        timeout: 30_000,
      })
      await expect(page.getByRole('button', { name: /Export CSV/ })).toHaveCount(0)

      const { bytes, request } = await downloadFrom(page, filename)
      expect(hasPivot(bytes)).toBe(true)
      // The screen pages; the export must not.
      expect(params(request).has('page')).toBe(false)
      expect(params(request).has('limit')).toBe(false)
    })
  }

  test('the export carries the warehouse filter picked on screen', async ({ page }) => {
    await gotoReady(page, '/inventory/reports')
    const location = page.locator('select').filter({ hasText: 'All Locations' })
    await expect(location.locator('option')).not.toHaveCount(1, { timeout: 30_000 })
    const warehouseId = await location.locator('option').nth(1).getAttribute('value')
    await location.selectOption(warehouseId!)
    await expect(page.getByRole('button', { name: EXPORT })).toBeEnabled({ timeout: 30_000 })

    const { request } = await downloadFrom(page, /inventory-valuation.*\.xlsx$/)
    expect(params(request).get('warehouseId')).toBe(warehouseId)
  })
})
