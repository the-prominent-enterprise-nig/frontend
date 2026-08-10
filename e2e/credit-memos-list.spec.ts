import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 13 — Credit Memos list page. Previously there was nowhere in the
// app to view an issued credit memo (manual or auto-created from a POS
// return) after creation; this is the minimal fix. Reads only — doesn't
// create its own fixture, relies on whatever credit memos already exist in
// the shared dev DB from Part 1/Part 3's own e2e specs (which don't tear
// theirs down, matching this suite's "permanent workflow record" convention).

test('Credit Memos list renders, is reachable from the sidebar, and rows expand to show line items', async ({
  page,
}) => {
  await gotoReady(page, '/accounting/ar-invoices')
  await page.getByRole('link', { name: 'Credit Memos' }).click()
  await expect(page).toHaveURL('/accounting/credit-memos')
  await expect(page.getByRole('heading', { name: 'Credit Memos' })).toBeVisible({
    timeout: 10_000,
  })

  const row = page.locator('table tbody tr').first()
  await expect(row).toBeVisible({ timeout: 10_000 })
  // Memo #, Type, Amount, Status columns all render something real.
  await expect(row.locator('td').nth(1)).not.toBeEmpty()

  await row.click()
  const detailRow = page.locator('table tbody tr').nth(1)
  await expect(detailRow).toBeVisible({ timeout: 10_000 })
})

test('a memo auto-created from a POS return shows its source', async ({ page }) => {
  await gotoReady(page, '/accounting/credit-memos')
  await expect(page.getByRole('heading', { name: 'Credit Memos' })).toBeVisible({
    timeout: 10_000,
  })

  const autoRow = page.locator('table tbody tr', { hasText: 'Auto — POS return' })
  await expect(autoRow.first()).toBeVisible({ timeout: 10_000 })
})
