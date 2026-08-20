import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 31 Part 3 — General Ledger gained an account filter; a running
// Balance column only appears once one account is selected (a running
// balance across mixed accounts is meaningless). Same-day follow-up:
// General Ledger was pulled out of the Reports hub into its own standalone
// page/route (no longer a Reports tab) per developer instruction — this
// spec targets that route directly. Exact balance math is covered by the
// backend e2e suite (test/general-ledger-running-balance.e2e-spec.ts),
// which controls exact amounts via direct Prisma writes — this spec
// verifies the UI surface: the filter exists, and the Balance column only
// shows up once it's used.

test('General Ledger only shows a Balance column once an account is selected', async ({ page }) => {
  await gotoReady(page, '/accounting/general-ledger')
  await expect(page.getByRole('heading', { name: 'General Ledger' })).toBeVisible({
    timeout: 10_000,
  })

  await page.getByRole('button', { name: 'Run Report' }).click()
  const table = page.locator('table').first()
  await expect(table).toBeVisible({ timeout: 10_000 })
  await expect(table.getByRole('columnheader', { name: 'Balance' })).toHaveCount(0)

  // Pick an account that actually has posted activity WITHIN the page's own
  // default date range (year-to-date) — an arbitrary account from the
  // dropdown could easily have zero transactions there, which renders the
  // "no posted transactions" empty state instead of a table with a Balance
  // column at all.
  const yearStart = `${new Date().getFullYear()}-01-01`
  const today = new Date().toISOString().slice(0, 10)
  const glRes = await page.request.get('/api/reports/general-ledger', {
    params: { startDate: yearStart, endDate: today },
  })
  const glRows = (await glRes.json()) as { account: { id: string } | null }[]
  const activeAccountId = glRows.find((r) => r.account)?.account?.id
  expect(activeAccountId).toBeTruthy()

  const accountSelect = page.getByRole('combobox', { name: 'Account' })
  await expect(accountSelect).toBeVisible()
  await accountSelect.selectOption(activeAccountId!)

  await page.getByRole('button', { name: 'Run Report' }).click()
  await expect(table.getByRole('columnheader', { name: 'Balance' })).toBeVisible({
    timeout: 10_000,
  })
})
