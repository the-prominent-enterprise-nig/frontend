import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 29 INV-02 — the rebuilt Aging report gets its own tab alongside
// Valuation/Turnover on /inventory/reports. Backend correctness (per-serial
// grouping, receipt-date aging, 5-bucket boundaries, createdAt fallback) is
// covered by backend/test/inventory-aging-report.e2e-spec.ts with tightly
// controlled fixture dates; this sticks to the UI surface — the tab loads
// real data, summary cards render, and the bucket filter narrows the table.
// Relies on the seed's real in-stock serial population rather than
// fabricating its own aged fixtures (the REST API has no way to backdate a
// SerialNumber's own createdAt for a UI-only test).

test.describe('Inventory — Aging Report', () => {
  test('Aging tab loads real per-serial data with working summary cards and bucket filter', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/reports')
    await page.getByRole('button', { name: 'Aging', exact: true }).click()

    // Summary cards — one per bucket. Scoped to `font-semibold` (the
    // summary card badge's own class) since the table below renders the
    // same bucket label text repeatedly per row (`font-medium`), which
    // would otherwise collide on a plain text match.
    const summaryBadges = page.locator('span.font-semibold')
    await expect(summaryBadges).toHaveCount(5, { timeout: 15_000 })
    await expect(summaryBadges.filter({ hasText: '0–30 days' })).toBeVisible()
    await expect(summaryBadges.filter({ hasText: '31–60 days' })).toBeVisible()
    await expect(summaryBadges.filter({ hasText: '61–90 days' })).toBeVisible()
    await expect(summaryBadges.filter({ hasText: '91–180 days' })).toBeVisible()
    await expect(summaryBadges.filter({ hasText: '180+ days' })).toBeVisible()

    // Table — the seed data has thousands of in-stock serials, so this
    // should never come back empty.
    const rows = page.locator('tbody tr')
    await expect(rows.first()).toBeVisible({ timeout: 15_000 })
    const initialRowCount = await rows.count()
    expect(initialRowCount).toBeGreaterThan(0)

    // Bucket filter — freshly seeded stock should be overwhelmingly 0-30
    // days old, so this bucket is reliably non-empty without needing any
    // aged fixture of its own.
    await page.getByLabel('Filter by age bucket').selectOption('0_30')
    await expect(rows.first()).toBeVisible({ timeout: 15_000 })
    const ageBadges = page.locator('tbody tr td:last-child span')
    const badgeCount = await ageBadges.count()
    expect(badgeCount).toBeGreaterThan(0)
    for (let i = 0; i < badgeCount; i++) {
      await expect(ageBadges.nth(i)).toHaveText('0–30 days')
    }

    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(page.getByLabel('Filter by age bucket')).toHaveValue('')
  })
})
