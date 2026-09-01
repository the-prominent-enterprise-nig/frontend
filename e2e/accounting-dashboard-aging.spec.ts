import { test, expect, type Page, type Locator } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 29 (Accounting section) — extractAging() expected a
// pre-aggregated `{buckets: [...]}` or bucket-keyed object shape that
// GET /reports/aging/:type never actually returns (it sends a flat array
// of invoice/bill rows, each with its own `outstanding` amount and `bucket`
// label) — so both AR and AP Aging charts always rendered "No data
// available" regardless of how much real overdue data existed. This test
// fetches the same live endpoint directly, computes the expected bucket
// sums the same way the fixed extractAging() does, and diffs against what
// the dashboard actually renders.

const BUCKET_LABELS: Record<string, string> = {
  Current: 'Current',
  '1-30': '1–30 days',
  '31-60': '31–60 days',
  '61-90': '61–90 days',
  '90+': '90+ days',
}

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return '₱0'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}₱${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}₱${(abs / 1_000).toFixed(0)}K`
  return `${sign}₱${Math.round(abs).toLocaleString('en-PH')}`
}

function panelByHeadingText(page: Page, headingText: string): Locator {
  return page
    .getByRole('heading', { name: headingText, exact: true })
    .locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]')
}

async function assertAgingPanelMatchesLiveData(
  page: Page,
  type: 'ar' | 'ap',
  panelHeading: string
) {
  const res = await page.request.get(`/api/reports/aging/${type}`)
  expect(res.ok()).toBeTruthy()
  const rows = (await res.json()) as { outstanding: number; bucket: string }[]

  const sums: Record<string, number> = {}
  rows.forEach((row) => {
    const key = row.bucket ?? 'Current'
    sums[key] = (sums[key] ?? 0) + Number(row.outstanding ?? 0)
  })
  const nonZeroBuckets = Object.entries(sums).filter(([, v]) => v > 0)
  test.skip(
    nonZeroBuckets.length === 0,
    `No real overdue ${type.toUpperCase()} data to check against`
  )

  await gotoReady(page, '/accounting')
  const panel = panelByHeadingText(page, panelHeading)
  await expect(panel).toBeVisible({ timeout: 15_000 })

  for (const [bucket, amount] of nonZeroBuckets) {
    const label = BUCKET_LABELS[bucket] ?? bucket
    const row = panel.locator('div', { hasText: label }).last()
    await expect(row).toContainText(fmtMoney(amount))
  }
}

test.describe('Accounting Dashboard — AR/AP Aging', () => {
  test('AR Aging shows real bucketed totals, not an empty state', async ({ page }) => {
    await assertAgingPanelMatchesLiveData(page, 'ar', 'AR Aging')
  })

  test('AP Aging shows real bucketed totals, not an empty state', async ({ page }) => {
    await assertAgingPanelMatchesLiveData(page, 'ap', 'AP Aging')
  })
})
