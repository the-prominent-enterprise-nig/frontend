import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can, canNavigate } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { HubTabs } from '../_shared/HubTabs'
import { CashInTransitList } from '../../pos/undeposited-funds/_components/CashInTransitList'

export const metadata = { title: 'Collected Funds History | NIG Central' }

/**
 * Scenario 53 — Accounting's own view of Cash-in-Transit, labelled Undeposited
 * Funds since Scenario 61 to match POS (the route and permissions keep the
 * cash-in-transit name).
 *
 * Deliberately renders the same CashInTransitList the POS route uses rather
 * than a parallel copy: the two screens show identical data and differ only in
 * who can act on it: the Cashier records deposits from POS, Accounting views
 * them here and corrects a mistyped one (accounting:cash-in-transit:correct).
 * That keeps the Accountant an accounting-only role instead of handing them
 * POS permissions they have no other use for.
 *
 * Ticket #76 (client, 2026-11-12) — the Cashier and the Branch Manager see this
 * screen in POS, so it is not repeated for them under Accounting. Their read
 * comes with POS's Collections feature rather than a row of their own, which is
 * what the tab strip counts (canNavigate), so the tab is already absent; the
 * route is closed the same way and sends them to POS's screen, keeping a
 * journal entry's ?deposit= link working.
 */
export default async function AccountingCashInTransitPage({
  searchParams,
}: {
  searchParams: Promise<{ deposit?: string }>
}) {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, ACCOUNTING_PERMISSIONS.CASH_IN_TRANSIT_READ)) {
    redirect('/403')
  }

  if (!canNavigate(session, ACCOUNTING_PERMISSIONS.CASH_IN_TRANSIT_READ)) {
    if (!can(session, POS_PERMISSIONS.CASH_IN_TRANSIT_READ)) {
      redirect('/403')
    }
    const { deposit } = await searchParams
    redirect(
      deposit
        ? `/pos/undeposited-funds?deposit=${encodeURIComponent(deposit)}`
        : '/pos/undeposited-funds'
    )
  }

  // 2026-10-23 (client decision) — deposits are recorded by the Cashier from
  // POS, so Accounting's view never offers Record deposit, even to a Business
  // Owner who could. Accounting views deposits and corrects a mistyped one.
  const canVerify = can(session, ACCOUNTING_PERMISSIONS.CASH_IN_TRANSIT_VERIFY)
  // The Business Owner's edit of a recorded entry opens it too: the correction
  // already asks for a reason, which is kept with the change.
  const canCorrect =
    can(session, ACCOUNTING_PERMISSIONS.CASH_IN_TRANSIT_CORRECT) ||
    can(session, ACCOUNTING_PERMISSIONS.RECORDED_ENTRIES_EDIT)

  // A branch-assigned caller (Accountant, Branch Manager) is restricted to
  // their own branch server-side too — PosDepositsService and
  // SessionsService.getCashInTransitReport() both force this regardless of
  // what's submitted.
  const restrictedBranchId = session.branchId ?? null

  return (
    <>
      <Suspense fallback={null}>
        <HubTabs hub="cash-banking" session={session} />
      </Suspense>
      <CashInTransitList
        title="Collected Funds History"
        canManage={false}
        canVerify={canVerify}
        canCorrect={canCorrect}
        restrictedBranchId={restrictedBranchId}
        isUnrestricted={restrictedBranchId === null}
      />
    </>
  )
}
