import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { CashInTransitList } from './_components/CashInTransitList'

export const metadata = { title: 'Undeposited Funds | Prominent Enterprise' }

export default async function CashInTransitPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, POS_PERMISSIONS.CASH_IN_TRANSIT_READ)) {
    redirect('/403')
  }

  // Scenario 53 — "POS cannot deposit, only accountant". The deposit is now an
  // Accounting capability, so this reads the accounting permission rather than
  // the POS one: a cashier never has it, while a Business Owner or Branch
  // Manager standing at this screen still does and shouldn't be sent to
  // Accounting to do the same thing. pos:cash-in-transit:manage is no longer
  // checked anywhere, and no longer reaches the deposit endpoint.
  const canManage = can(session, ACCOUNTING_PERMISSIONS.CASH_IN_TRANSIT_MANAGE)

  // A branch-assigned caller (Branch Manager) is restricted to their own
  // branch server-side too (BankAccountsService.clearCashInTransit() and
  // SessionsService.getCashInTransitReport() both force this regardless of
  // what's submitted).
  const restrictedBranchId = session.branchId ?? null

  return (
    <CashInTransitList
      title="Undeposited Funds"
      canManage={canManage}
      restrictedBranchId={restrictedBranchId}
      isUnrestricted={restrictedBranchId === null}
    />
  )
}
