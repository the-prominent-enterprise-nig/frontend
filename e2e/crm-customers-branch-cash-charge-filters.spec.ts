import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// The CRM customer list filters by branch and by cash/charge. Status and
// source are gone from this screen entirely — both filters and both columns —
// at the client's request; the API still serves them for the dashboard
// summaries, they're just not how anyone narrows this list. The Cash/Charge
// "Type" column went too (client request); the cash/charge filter stays.
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
    await expect(headers.filter({ hasText: 'Type' })).toHaveCount(0)
    await expect(headers.filter({ hasText: 'Source' })).toHaveCount(0)
    await expect(headers.filter({ hasText: 'Status' })).toHaveCount(0)
  })

  test('narrowing to charge customers re-queries the list', async ({ page }) => {
    await gotoReady(page, '/crm/customers')
    await expect(page.locator('tbody')).not.toContainText('Loading…', { timeout: 10_000 })

    const response = page.waitForResponse(
      (r) => r.url().includes('/crm/customers') && r.url().includes('accountType=charge'),
      { timeout: 10_000 }
    )
    await page.getByLabel('Filter by cash or charge').selectOption('charge')
    const body = (await (await response).json()) as { data?: { accountType?: string }[] }

    await expect(page.locator('tbody')).not.toContainText('Loading…', { timeout: 10_000 })
    // Every customer that came back is a charge customer (an empty result is
    // a legitimate outcome on a book with no charge accounts). Read from the
    // response: the table no longer has a Cash/Charge column to read it from.
    for (const c of body.data ?? []) {
      expect(c.accountType).toBe('charge')
    }
  })
})
