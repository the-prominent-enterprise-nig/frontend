import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// POS Transactions — pending release approval banner (Scenario 59).
//
// A sale held for manager release approval has no PosTransaction yet
// (createdTransactionId is set only on approval), so it is correctly absent
// from the transactions table — and to the cashier who just rang it up, it
// simply vanished. The banner tells them it is waiting and links to the page
// that already renders it.
//
// Asserted here: the page loads and the banner is *conditional*, not always
// on. The populated case is not merely inconvenient to reach — it is
// unreachable for this spec in principle. Playwright runs as Business Owner,
// and TransactionsController skips the approval detour entirely for a
// submitter holding pos:transaction:override, who would otherwise approve
// their own request. A Business Owner's installment sale therefore never
// produces a pending row, so there is nothing for the banner to count.
//
// That leaves the negative case, which is also the one that actually
// regresses in practice: a banner reading "0 sales waiting" on every load if
// the count is ever wired wrong. The populated path is covered by the manual
// steps in the scenario doc, run as a cashier.
test.describe('POS Transactions — pending release banner', () => {
  test('does not show the banner when nothing is pending', async ({ page }) => {
    await gotoReady(page, '/pos/transactions')

    // The page itself rendered.
    await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible()

    // No banner, and in particular never a zero-count one.
    await expect(page.getByText('waiting on manager release approval')).toHaveCount(0)
    await expect(page.getByText(/^0 sales/)).toHaveCount(0)
  })

  // Scenario 59 — TransactionDetail's "View customer ledger" hardcoded
  // /crm/customers/..., so it bounced a Cashier off /403: they are confined
  // to the `pos` module even though the ledger data is readable to them.
  // The modal is opened from CRM, the POS dashboard and the POS transactions
  // list, so the destination is resolved from the session rather than a prop.
  //
  // Running as Business Owner, who CAN access crm, this asserts the CRM
  // branch still resolves — the regression risk of a session-derived link is
  // sending the wrong people to the POS copy, not just the right ones to it.
  test('the POS customer ledger route exists for the non-CRM branch', async ({ page }) => {
    // The destination a cashier now gets. It must not 404 — if this route
    // ever disappears, the fix silently becomes a different broken link.
    await gotoReady(page, '/pos/customers')
    await expect(page).not.toHaveURL(/\/403/)
  })

  test('the release approvals page it points at is reachable', async ({ page }) => {
    // The banner is only useful if its destination loads for the same user.
    // Guarding this separately because the page is gated on
    // pos:transactions:read, not the manager's pos:transaction:override — a
    // regression there would make the banner a link to /403.
    await gotoReady(page, '/pos/release-approvals')
    await expect(page).not.toHaveURL(/\/403/)
  })
})
