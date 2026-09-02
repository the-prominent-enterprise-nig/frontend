import { test, expect, type Page, type Locator } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 29 (CRM section) — Win Rate, Lead Status, Won/Lost, and Customer
// Sources were all computed client-side off a 200-row fetch cap on the
// dashboard's own leads/customers list calls, so they'd silently undercount
// once a tenant crossed that. Fixed by real server-side aggregate endpoints
// (GET /crm/leads/status-summary, GET /crm/customers/source-summary). This
// test proves the dashboard actually renders those endpoints' numbers, not
// a hardcoded/stale UI — by fetching the same endpoints directly and
// diffing against what's on screen.

const SOURCE_LABELS: Record<string, string> = {
  pos_walkin: 'Walk-in (POS)',
  sales: 'Sales',
  crm_lead: 'CRM Lead',
  online: 'Online',
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`
}

// Same nearest-ancestor xpath trick as crm-dashboard-overdue-reminders.spec.ts
// — a plain `has:` locator would match every ancestor div up to the page
// root, not just this specific card.
function panelByHeadingText(page: Page, headingText: string): Locator {
  return page
    .getByText(headingText, { exact: true })
    .locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]')
}

test.describe('CRM Dashboard — Fetch-Cap Aggregates', () => {
  test('Win Rate KPI matches the real status-summary endpoint, not a capped client computation', async ({
    page,
  }) => {
    const summaryRes = await page.request.get('/api/crm/leads/status-summary')
    expect(summaryRes.ok()).toBeTruthy()
    const summary = await summaryRes.json()

    await gotoReady(page, '/crm')

    const winRateCard = page.getByRole('link', { name: /Win Rate/i })
    await expect(winRateCard).toBeVisible({ timeout: 15_000 })
    await expect(winRateCard).toContainText(fmtPct(summary.winRate))
  })

  test('Lead Status donut segment values sum to the real status-summary totals', async ({
    page,
  }) => {
    const summaryRes = await page.request.get('/api/crm/leads/status-summary')
    expect(summaryRes.ok()).toBeTruthy()
    const summary = await summaryRes.json()
    const expectedTotal = summary.active + summary.won + summary.lost + summary.archived

    await gotoReady(page, '/crm')

    const leadStatusPanel = panelByHeadingText(page, 'Lead Status')
    await expect(leadStatusPanel).toBeVisible({ timeout: 15_000 })
    // The panel heading renders immediately, but its data loads
    // asynchronously — retry the read+sum until the fetch actually lands
    // rather than reading a one-shot empty/skeleton state.
    await expect(async () => {
      // DonutChart's legend renders each segment as `{value} ({pct}%)` in a
      // `.tabular-nums` span — take just the leading number per span (not
      // the parenthesized percentage) so this doesn't double-count.
      const badgeTexts = await leadStatusPanel.locator('span.tabular-nums').allInnerTexts()
      const sumOfSegmentValues = badgeTexts.reduce((sum, text) => {
        const leadingNumber = Number(text.trim().split(/\s/)[0])
        return sum + (Number.isFinite(leadingNumber) ? leadingNumber : 0)
      }, 0)
      // If the donut were still reading from the capped 200-lead list
      // instead of the real status-summary total, this would diverge for
      // any tenant whose real lead count exceeds 200.
      expect(sumOfSegmentValues).toBe(expectedTotal)
    }).toPass({ timeout: 15_000 })
  })

  test('Total Customers "N active" sub-label matches the real status-summary endpoint', async ({
    page,
  }) => {
    const summaryRes = await page.request.get('/api/crm/customers/status-summary')
    expect(summaryRes.ok()).toBeTruthy()
    const summary = await summaryRes.json()

    await gotoReady(page, '/crm')

    const totalCustomersCard = page.getByRole('link', { name: /Total Customers/i })
    await expect(totalCustomersCard).toBeVisible({ timeout: 15_000 })
    await expect(totalCustomersCard).toContainText(`${summary.active} active`)
  })

  test('Customer Sources chart shows the real per-channel count from source-summary', async ({
    page,
  }) => {
    const summaryRes = await page.request.get('/api/crm/customers/source-summary')
    expect(summaryRes.ok()).toBeTruthy()
    const summary = (await summaryRes.json()) as { sourceChannel: string; count: number }[]
    const nonZero = summary.find((r) => r.count > 0)
    test.skip(!nonZero, 'No seeded customers with a non-zero source channel to check against')
    if (!nonZero) return

    await gotoReady(page, '/crm')

    const sourcesPanel = panelByHeadingText(page, 'Customer Sources')
    await expect(sourcesPanel).toBeVisible({ timeout: 15_000 })
    const label = SOURCE_LABELS[nonZero.sourceChannel] ?? nonZero.sourceChannel
    const row = sourcesPanel.locator('div', { hasText: label }).last()
    await expect(row).toContainText(String(nonZero.count))
  })

  test('Interactions by Type sums to the real type-summary total, not a capped 100-row computation', async ({
    page,
  }) => {
    const summaryRes = await page.request.get('/api/crm/interactions/type-summary')
    expect(summaryRes.ok()).toBeTruthy()
    const summary = (await summaryRes.json()) as { interactionType: string; count: number }[]
    const expectedTotal = summary.reduce((sum, r) => sum + r.count, 0)
    test.skip(expectedTotal === 0, 'No seeded interactions to check against')

    await gotoReady(page, '/crm')

    const typePanel = panelByHeadingText(page, 'Interactions by Type')
    await expect(typePanel).toBeVisible({ timeout: 15_000 })
    await expect(async () => {
      const values = await typePanel.locator('p.tabular-nums').allInnerTexts()
      const sum = values.reduce((total, text) => total + (Number(text.trim()) || 0), 0)
      expect(sum).toBe(expectedTotal)
    }).toPass({ timeout: 15_000 })
  })
})
