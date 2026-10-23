import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { CashInTransitList } from './_components/CashInTransitList'

export const metadata = { title: 'Undeposited Funds | NIG Central' }

export default async function CashInTransitPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, POS_PERMISSIONS.CASH_IN_TRANSIT_READ)) {
    redirect('/403')
  }

  // 2026-10-23 (client decision) — the Cashier records the branch's
  // deposits and the Accountant has view access. Recording one posts it, so
  // canVerify only matters for a draft left from before that change.
  const canManage = can(session, ACCOUNTING_PERMISSIONS.CASH_IN_TRANSIT_MANAGE)
  const canVerify = can(session, ACCOUNTING_PERMISSIONS.CASH_IN_TRANSIT_VERIFY)
  const canCorrect = can(session, ACCOUNTING_PERMISSIONS.CASH_IN_TRANSIT_CORRECT)

  // A branch-assigned caller (the Cashier, a Branch Manager) is restricted to
  // their own branch server-side too (PosDepositsService and
  // SessionsService.getCashInTransitReport() both force this regardless of
  // what's submitted).
  const restrictedBranchId = session.branchId ?? null

  return (
    <CashInTransitList
      title="Undeposited Funds"
      canManage={canManage}
      canVerify={canVerify}
      canCorrect={canCorrect}
      restrictedBranchId={restrictedBranchId}
      isUnrestricted={restrictedBranchId === null}
    />
  )
}
