import { test, expect } from '@playwright/test'
import { gotoReady, fillStable, clickStable, loginAs } from './utils'

/**
 * Scenario 14 (Accounting Month-End) Closing Gap 1 — Tax Rate Approver
 * Gating.
 *
 * Covers the UI side of the pending-approval workflow: an Accountant's
 * submission shows as "Awaiting approval" and does not appear as a live
 * rate; only a Business Owner sees Approve/Reject controls and approving
 * makes the rate live.
 *
 * Needs two roles in one spec (Accountant submits, Business Owner
 * approves — the approver must differ from the submitter), so this
 * overrides the default Business-Owner storageState with a blank one and
 * logs in per-step via loginAs(), mirroring the pattern in
 * pos-service-draft-complete.spec.ts.
 */
test.describe('Accounting — Tax Rate Approver Gating (Scenario 14 Closing Gap 1)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  const ACCOUNTANT_EMAIL = process.env.E2E_ACCOUNTANT_EMAIL ?? 'technova.b1.accounting@test.com'
  const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'technova.owner@test.com'
  const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'

  test('a submitted tax rate change stays pending until a different-person Business Owner approves it', async ({
    page,
  }) => {
    const rateName = `E2E Scen14 Zero-Rated ${Date.now()}`

    await loginAs(page, ACCOUNTANT_EMAIL, PASSWORD)
    await gotoReady(page, '/accounting/tax')

    await clickStable(
      page.getByRole('button', { name: 'New Rate' }),
      page.getByPlaceholder('e.g. VAT 12%')
    )
    await fillStable(page.getByPlaceholder('e.g. VAT 12%'), rateName)
    await fillStable(page.getByPlaceholder('12.00'), '5')
    await page.getByLabel('Type').selectOption('zero_rated')
    await page.getByRole('button', { name: 'Submit for Approval' }).click()

    // Staged as pending — Accountant has no approve permission, so the
    // pending row shows a status label instead of Approve/Reject buttons.
    const pendingRowAsAccountant = page.locator('tr').filter({ hasText: rateName })
    await expect(pendingRowAsAccountant).toBeVisible({ timeout: 10_000 })
    await expect(pendingRowAsAccountant.getByText('Awaiting approval')).toBeVisible()

    // Not a live rate yet — only appears in the Pending panel, not the main table.
    const mainTable = page.getByTestId('tax-rates-table')
    await expect(mainTable.getByText(rateName)).toHaveCount(0)

    // Switch to Business Owner — the only role with accounting:tax:approve.
    await page.context().clearCookies()
    await loginAs(page, OWNER_EMAIL, PASSWORD)
    await gotoReady(page, '/accounting/tax')
    await waitForHydration(page)

    const pendingRowAsOwner = page.locator('tr').filter({ hasText: rateName })
    await expect(pendingRowAsOwner).toBeVisible({ timeout: 10_000 })
    await clickStable(
      pendingRowAsOwner.getByRole('button', { name: 'Approve' }),
      mainTable.getByText(rateName)
    )

    // Now live in the main table, no longer in the pending list.
    await expect(mainTable.getByText(rateName)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Pending Tax Rate Changes')).toHaveCount(0)

    // Cleanup: submit a deactivate (as Accountant, since Owner already
    // acted as approver on the create and can't decide their own
    // submission either) and approve it (as Owner) so the rate doesn't
    // linger active in the shared dev database — deactivation is the
    // equivalent of "delete" for this soft-delete-only entity.
    await page.context().clearCookies()
    await loginAs(page, ACCOUNTANT_EMAIL, PASSWORD)
    await gotoReady(page, '/accounting/tax')
    await waitForHydration(page)
    const liveRow = page.locator('tbody tr').filter({ hasText: rateName })
    page.once('dialog', (dialog) => dialog.accept())
    await liveRow.getByTitle('Delete').click()
    await expect(page.getByText('Pending Tax Rate Changes')).toBeVisible({ timeout: 10_000 })

    await page.context().clearCookies()
    await loginAs(page, OWNER_EMAIL, PASSWORD)
    await gotoReady(page, '/accounting/tax')
    await waitForHydration(page)
    const deactivatePendingRow = page
      .locator('tr')
      .filter({ hasText: rateName })
      .filter({ hasText: 'Deactivate' })
    await expect(deactivatePendingRow).toBeVisible({ timeout: 10_000 })
    await deactivatePendingRow.getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByText('Pending Tax Rate Changes')).toHaveCount(0, { timeout: 10_000 })
  })
})

/**
 * Same hydration race clickStable works around, but for the first
 * interaction right after a fresh navigation where there's no single
 * "expected" locator to retry against yet — waits for a control that only
 * renders once the Configuration tab has hydrated.
 */
async function waitForHydration(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'New Rate' })).toBeVisible({ timeout: 15_000 })
}
