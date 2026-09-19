import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { CashInTransitList } from '../../pos/cash-in-transit/_components/CashInTransitList'

export const metadata = { title: 'Cash-in-Transit | Prominent Enterprise' }

/**
 * Scenario 53 — Accounting's own view of Cash-in-Transit.
 *
 * Deliberately renders the same CashInTransitList the POS route uses rather
 * than a parallel copy: the two screens show identical data and differ only in
 * who can act on it. What separates them is the permission — POS reads with
 * pos:cash-in-transit:read and can never deposit, Accounting reads with
 * accounting:cash-in-transit:read and deposits with :manage. That keeps the
 * Accountant an accounting-only role instead of handing them POS permissions
 * they have no other use for.
 */
export default async function AccountingCashInTransitPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, ACCOUNTING_PERMISSIONS.CASH_IN_TRANSIT_READ)) {
    redirect('/403')
  }

  const canManage = can(session, ACCOUNTING_PERMISSIONS.CASH_IN_TRANSIT_MANAGE)

  // A branch-assigned caller (Accountant, Branch Manager) is restricted to
  // their own branch server-side too — BankAccountsService.clearCashInTransit()
  // and SessionsService.getCashInTransitReport() both force this regardless of
  // what's submitted.
  const restrictedBranchId = session.branchId ?? null

  return (
    <CashInTransitList
      canManage={canManage}
      restrictedBranchId={restrictedBranchId}
      isUnrestricted={restrictedBranchId === null}
    />
  )
}
