import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
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
 */
export default async function AccountingCashInTransitPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, ACCOUNTING_PERMISSIONS.CASH_IN_TRANSIT_READ)) {
    redirect('/403')
  }

  // 2026-10-23 (client decision) — deposits are recorded by the Cashier from
  // POS, so Accounting's view never offers Record deposit, even to a Business
  // Owner who could. Accounting views deposits and corrects a mistyped one.
  const canVerify = can(session, ACCOUNTING_PERMISSIONS.CASH_IN_TRANSIT_VERIFY)
  const canCorrect = can(session, ACCOUNTING_PERMISSIONS.CASH_IN_TRANSIT_CORRECT)

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
