import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

// Shared by both describe blocks below — picks the first real bank account
// option (same hydration-race-safe retry as the inline version in Part 2's
// own test) and starts a reconciliation with the given statement balance,
// landing on its worksheet page.
async function startReconciliation(page: Page, statementBalance: string): Promise<string> {
  await gotoReady(page, '/accounting/bank-reconciliation/new')
  await expect(page.getByRole('heading', { name: 'New Reconciliation' })).toBeVisible({
    timeout: 10_000,
  })
  const accountSelect = page.getByLabel('Bank Account *')
  let selectedValue = ''
  await expect(async () => {
    const value = await accountSelect.locator('option').nth(1).getAttribute('value')
    expect(value).toBeTruthy()
    selectedValue = value as string
    await accountSelect.selectOption(selectedValue)
    await expect(accountSelect).toHaveValue(selectedValue)
  }).toPass({ timeout: 20_000 })

  await page.getByLabel('Statement Date *').fill('2026-07-31')
  await page.getByLabel('Statement Balance *').fill(statementBalance)
  await page.getByRole('button', { name: 'Start Reconciliation' }).click()
  await page.waitForURL(/\/accounting\/bank-reconciliation\/[0-9a-f-]{36}$/, { timeout: 10_000 })
  return page.url()
}

function parseMoney(text: string | null): number {
  return Number((text ?? '').replace(/[^\d.-]/g, ''))
}

// Scenario 42 Part 2 — Bank Reconciliation's "New Reconciliation" is now a
// full page (not a modal), and creating one generates a real worksheet page
// instead of just logging two typed numbers. No delete endpoint exists for
// a BankReconciliation (same as Fund Transfer, see fund-transfer.spec.ts) —
// this spec doesn't attempt cleanup, same accepted-permanent-fixture
// precedent used there.
test.describe('Accounting — Bank Reconciliation Worksheet (Scenario 42 Part 2)', () => {
  test('starts a reconciliation from the New Reconciliation page and lands on a generated worksheet', async ({
    page,
  }) => {
    // First hit via the actual "New Reconciliation" link, proving it
    // navigates to a real page rather than opening a modal — startReconciliation()
    // (used everywhere else in this file) goes straight to the URL instead.
    await gotoReady(page, '/accounting/bank-reconciliation')
    await page.getByRole('link', { name: 'New Reconciliation' }).click()
    await page.waitForURL('**/accounting/bank-reconciliation/new')
    await expect(page.getByRole('heading', { name: 'New Reconciliation' })).toBeVisible({
      timeout: 10_000,
    })

    const worksheetUrl = await startReconciliation(page, '123456')

    // System Balance is computed, not the value we typed — and Adjusted
    // Balance equals the typed Statement Balance exactly since nothing is
    // checked yet (no pending items confirmed cleared).
    await expect(page.getByText('Statement Balance')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('System Balance')).toBeVisible()
    await expect(page.getByText('Adjusted Balance')).toBeVisible()
    // exact: true — a nonzero-discrepancy hint (Part 3) also contains the
    // word "Discrepancy", so a loose match can resolve to two elements.
    await expect(page.getByText('Discrepancy', { exact: true })).toBeVisible()
    await expect(page.getByText('₱123,456.00').first()).toBeVisible()
    await expect(page.getByText('Pending Deposits')).toBeVisible()
    await expect(page.getByText('Pending Withdrawals')).toBeVisible()

    // Checking a pending line off (if this account happens to have any)
    // moves Adjusted Balance/Discrepancy live via the immediate PATCH —
    // best-effort since real pending data is seed-dependent.
    const firstCheckbox = page.locator('table input[type="checkbox"]').first()
    if (await firstCheckbox.isVisible().catch(() => false)) {
      const discrepancyBefore = await page
        .getByText('Discrepancy', { exact: true })
        .locator('..')
        .locator('p')
        .nth(1)
        .textContent()
      await firstCheckbox.check()
      await expect
        .poll(
          async () =>
            page
              .getByText('Discrepancy', { exact: true })
              .locator('..')
              .locator('p')
              .nth(1)
              .textContent(),
          { timeout: 5_000 }
        )
        .not.toBe(discrepancyBefore)
    }

    // The list page's rows link back to the same worksheet — matched by the
    // distinctive statement balance just entered, not "first row" (ordering
    // ties with other reconciliations sharing the same statement date). This
    // page renders three separate tables (reconciliations, clearing
    // settlements, unidentified credits) — scope to the first one.
    await gotoReady(page, '/accounting/bank-reconciliation')
    const reconciliationsTable = page.locator('table').first()
    await expect(reconciliationsTable.locator('tbody')).not.toContainText('Loading...', {
      timeout: 10_000,
    })
    await reconciliationsTable.locator('tbody tr', { hasText: '123,456.00' }).first().click()
    await page.waitForURL(worksheetUrl, { timeout: 10_000 })
  })
})

// Scenario 42 Part 3 — Complete only unlocks at zero discrepancy. No exact
// pending data is assumed here either: a probe reconciliation reads the
// real computed System Balance back off the page, then a second one is
// started with a Statement Balance chosen to land exactly on it — with
// nothing checked, Adjusted Balance = Statement Balance, so that's a
// reliable zero-discrepancy case without needing any real pending items.
test.describe('Accounting — Bank Reconciliation Complete Gating (Scenario 42 Part 3)', () => {
  test('Mark Reconciled is disabled with a nonzero discrepancy, and enabled once it reaches zero', async ({
    page,
  }) => {
    await startReconciliation(page, '0') // probe, only to read the real System Balance
    const systemBalanceText = await page
      .getByText('System Balance')
      .locator('..')
      .locator('p')
      .nth(1)
      .textContent()
    const systemBalance = parseMoney(systemBalanceText)
    expect(Number.isFinite(systemBalance)).toBe(true)

    // Deliberately wrong — Mark Reconciled must stay disabled.
    await startReconciliation(page, String(systemBalance + 999))
    const markReconciledButton = page.getByRole('button', { name: 'Mark Reconciled' })
    await expect(markReconciledButton).toBeVisible({ timeout: 10_000 })
    await expect(markReconciledButton).toBeDisabled()
    await expect(page.getByText('Check off every item that actually cleared')).toBeVisible()

    // Exactly right — Mark Reconciled enables, and completing flips the badge.
    await startReconciliation(page, String(systemBalance))
    const readyButton = page.getByRole('button', { name: 'Mark Reconciled' })
    await expect(readyButton).toBeEnabled({ timeout: 10_000 })
    await readyButton.click()
    await expect(page.getByText('Reconciled', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Mark Reconciled' })).toHaveCount(0)
  })
})
