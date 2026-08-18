import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 29 ACC-07 — three GL reconciliation checks surfaced on the
// Reports page's "GL Reconciliation" tab. Deep-linkable via ?tab=reconciliation,
// matching the hub's existing ?tab=customer-statement convention. The
// checks are self-contained (own asOf/days controls, fetch on mount), so
// this only verifies the UI surface loads real data end to end — precise
// mismatch fixtures are covered by the backend e2e suite
// (test/accounting-gl-reconciliation.e2e-spec.ts), which controls exact
// amounts via direct Prisma writes Playwright has no way to reach.

test.describe('Accounting — GL Reconciliation (Scenario 29 ACC-07)', () => {
  test.beforeAll(async ({ request }) => {
    // POS_EWALLET is deliberately left unmapped by the seed (manual-config-
    // only by design — see coa-seed.service.ts) — without a mapping the
    // e-wallet check 400s and its section never renders. Configuring it via
    // the same PATCH /account-mapping/:key endpoint the Settings UI itself
    // uses, matching how the backend e2e spec upserts it directly.
    const accountsRes = await request.get('/api/accounts')
    const accounts = (await accountsRes.json()) as { id: string; number: string }[]
    const ewalletAccount = accounts.find((a) => a.number === '1-01-112')
    if (ewalletAccount) {
      await request.patch('/api/account-mapping/POS_EWALLET', {
        data: { accountId: ewalletAccount.id },
      })
    }
  })

  test('all three checks load real data on the Reports page', async ({ page }) => {
    await gotoReady(page, '/accounting/reports?tab=reconciliation')

    await expect(
      page.getByRole('heading', { name: 'AR Subledger vs. AR Receivable (GL)' })
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Reconciled|Mismatch/).first()).toBeVisible({ timeout: 15_000 })

    await expect(
      page.getByRole('heading', {
        name: 'Remaining Installment Markup vs. Unearned Interest Income (GL)',
      })
    ).toBeVisible()

    await expect(page.getByRole('heading', { name: 'E-Wallet Clearing Trend' })).toBeVisible()
    await expect(page.getByText(/Trending down|Trending up|Flat/)).toBeVisible()
    await expect(
      page.getByText('No automated e-wallet settlement action exists', { exact: false })
    ).toBeVisible()
  })

  test('the shared report controls are hidden on this tab, which has its own', async ({ page }) => {
    await gotoReady(page, '/accounting/reports?tab=reconciliation')
    await expect(
      page.getByRole('heading', { name: 'AR Subledger vs. AR Receivable (GL)' })
    ).toBeVisible({ timeout: 15_000 })

    await expect(page.getByRole('button', { name: 'Run Report' })).toBeHidden()
    await expect(page.getByRole('button', { name: /Run Checks|Checking/ })).toBeVisible()
    await expect(page.getByLabel('E-wallet trend window (days)')).toHaveValue('30')
  })
})
