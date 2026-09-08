import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// The CRM customer list filters by branch and by cash/charge. Status and
// source are gone from this screen entirely — both filters and both columns —
// at the client's request; the API still serves them for the dashboard
// summaries, they're just not how anyone narrows this list.
test.describe('CRM — Customers list filters', () => {
  test('offers branch and cash/charge, and no longer offers status or source', async ({ page }) => {
    await gotoReady(page, '/crm/customers')
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible({ timeout: 10_000 })

    await expect(page.getByLabel('Filter by branch')).toBeVisible()
    await expect(page.getByLabel('Filter by cash or charge')).toBeVisible()

    // The removed filters, by their own option labels.
    await expect(page.getByRole('option', { name: 'All statuses' })).toHaveCount(0)
    await expect(page.getByRole('option', { name: 'All sources' })).toHaveCount(0)

    // Columns follow the filters.
    const headers = page.locator('thead th')
    await expect(headers.filter({ hasText: 'Branch' })).toHaveCount(1)
    await expect(headers.filter({ hasText: 'Type' })).toHaveCount(1)
    await expect(headers.filter({ hasText: 'Source' })).toHaveCount(0)
    await expect(headers.filter({ hasText: 'Status' })).toHaveCount(0)
  })

  test('narrowing to charge customers re-queries the list', async ({ page }) => {
    await gotoReady(page, '/crm/customers')
    await expect(page.locator('tbody')).not.toContainText('Loading…', { timeout: 10_000 })

    const request = page.waitForRequest(
      (r) => r.url().includes('/crm/customers') && r.url().includes('accountType=charge'),
      { timeout: 10_000 }
    )
    await page.getByLabel('Filter by cash or charge').selectOption('charge')
    await request

    await expect(page.locator('tbody')).not.toContainText('Loading…', { timeout: 10_000 })
    // Every row that came back is a charge customer (an empty result is a
    // legitimate outcome on a book with no charge accounts).
    const typeCells = page.locator('tbody tr td:nth-child(5)')
    const count = await typeCells.count()
    for (let i = 0; i < count; i++) {
      await expect(typeCells.nth(i)).toContainText('Charge')
    }
  })
})
