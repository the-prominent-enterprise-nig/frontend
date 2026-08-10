import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 13 (Credit & Debit Memos) Part 2 — the new SALES_RETURNS_ALLOWANCES
// mapping shows up as a paired row ("Credit Memo — Sales Return") on Settings
// → Account Mapping, same pattern as the existing Repair Assessed /
// Cost of Goods Sold pairs. Does not assert on a specific account being
// selected — this dev DB's SALES_RETURNS_ALLOWANCES mapping is set up by
// the backend e2e suite (credit-memos.e2e-spec.ts), which may or may not
// have run before this spec.

test('Credit Memo — Sales Return appears as a paired mapping row', async ({ page }) => {
  await gotoReady(page, '/accounting/account-mapping')
  await expect(page.getByText('Paired mappings', { exact: false })).toBeVisible({
    timeout: 10_000,
  })

  const row = page.locator('tr', { has: page.getByText('Credit Memo — Sales Return') })
  await expect(row).toBeVisible({ timeout: 10_000 })
  // Two account <select>s on the row (debit + credit side).
  await expect(row.locator('select')).toHaveCount(2)
})
