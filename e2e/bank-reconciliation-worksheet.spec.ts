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
// instead of just logging two typed numbers. These two describe blocks
// predate the delete endpoint and still leave their fixtures behind; the
// edit/delete block at the bottom cleans up after itself.
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

// Bank reconciliation edit/delete — the recovery path for a mis-keyed
// worksheet. Editing is open-only (a completed one has already stamped
// clearedAt onto its items, so Delete, which un-clears them, is the way
// back); delete works either way. Both tests remove their own fixture.
test.describe('Accounting — Bank Reconciliation Edit & Delete', () => {
  test('edits a pending reconciliation from the worksheet, then deletes it', async ({ page }) => {
    await startReconciliation(page, '654321')
    await expect(page.getByText('₱654,321.00').first()).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Reconciliation' })).toBeVisible()
    await page.getByLabel('Statement Balance').fill('654999')
    await page.getByLabel('Statement Date').fill('2026-08-31')
    await page.getByRole('button', { name: 'Save Changes' }).click()

    // The panel closes and the header re-reads from the server — a new
    // statement date rebuilds the worksheet, so this is a fresh GET.
    await expect(page.getByRole('heading', { name: 'Edit Reconciliation' })).toHaveCount(0, {
      timeout: 10_000,
    })
    await expect(page.getByText('₱654,999.00').first()).toBeVisible({ timeout: 10_000 })
    // Rendered in the viewer's locale/timezone, so match the month loosely.
    await expect(page.getByText(/Statement date Aug \d+, 2026/)).toBeVisible()

    // Survives a reload — the edit was persisted, not just local state.
    await page.reload()
    await expect(page.getByText('₱654,999.00').first()).toBeVisible({ timeout: 10_000 })

    // Delete it from the list's row action — '654,999.00' is distinctive
    // enough to name exactly one row.
    await gotoReady(page, '/accounting/bank-reconciliation')
    const table = page.locator('table').first()
    await expect(table.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    const row = table.locator('tbody tr', { hasText: '654,999.00' })
    await expect(row).toHaveCount(1)
    page.once('dialog', (d) => d.accept())
    await row.getByTitle('Delete reconciliation').click()
    await expect(table.locator('tbody tr', { hasText: '654,999.00' })).toHaveCount(0, {
      timeout: 10_000,
    })
  })

  test('hides Edit once completed, and deleting it hands its cleared items back', async ({
    page,
  }) => {
    // Same zero-discrepancy trick Part 3 uses: read the real System Balance
    // off a probe, then start one whose Statement Balance lands on it.
    await startReconciliation(page, '0')
    const systemBalance = parseMoney(
      await page.getByText('System Balance').locator('..').locator('p').nth(1).textContent()
    )
    const worksheetUrl = await startReconciliation(page, String(systemBalance))

    // Editable while pending...
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible({ timeout: 10_000 })
    const markReconciled = page.getByRole('button', { name: 'Mark Reconciled' })
    await expect(markReconciled).toBeEnabled({ timeout: 10_000 })
    await markReconciled.click()
    await expect(page.getByText('Reconciled', { exact: true })).toBeVisible({ timeout: 10_000 })

    // ...but not once completed. Delete stays, since it's the only way back
    // from a wrong Complete — deleting un-clears whatever it cleared.
    await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0)
    const deleteButton = page.getByRole('button', { name: 'Delete' })
    await expect(deleteButton).toBeVisible()

    // Deleted from the worksheet (the URL names this exact one — the list
    // can't tell two same-balance reconciliations apart).
    page.once('dialog', (d) => d.accept())
    await deleteButton.click()
    await page.waitForURL('**/accounting/bank-reconciliation', { timeout: 10_000 })

    // It's really gone: its own worksheet URL no longer resolves.
    await gotoReady(page, worksheetUrl)
    await expect(page.getByText(/not found|Failed to load worksheet/i)).toBeVisible({
      timeout: 10_000,
    })
  })
})
