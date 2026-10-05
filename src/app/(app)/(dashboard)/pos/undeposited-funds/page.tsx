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

  // Scenario 53 — "POS cannot deposit, only accountant". The deposit is an
  // Accounting capability, so this reads the accounting permission rather than
  // the POS one. Scenario 61 Part 5 (2026-10-02): only accounting deposits —
  // the Accountant and Business Owner; the Branch Manager and Cashier see the
  // balances and each deposit's status but cannot record or clear one.
  const canManage = can(session, ACCOUNTING_PERMISSIONS.CASH_IN_TRANSIT_MANAGE)
  // Scenario 61 Part 5 — only accounting deposits: recording a draft (manage)
  // and clearing it (verify) are both accounting's.
  const canVerify = can(session, ACCOUNTING_PERMISSIONS.CASH_IN_TRANSIT_VERIFY)

  // A branch-assigned caller (Branch Manager) is restricted to their own
  // branch server-side too (BankAccountsService.clearCashInTransit() and
  // SessionsService.getCashInTransitReport() both force this regardless of
  // what's submitted).
  const restrictedBranchId = session.branchId ?? null

  return (
    <CashInTransitList
      title="Undeposited Funds"
      canManage={canManage}
      canVerify={canVerify}
      restrictedBranchId={restrictedBranchId}
      isUnrestricted={restrictedBranchId === null}
    />
  )
}
