import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { CashInTransitList } from './_components/CashInTransitList'

export const metadata = { title: 'Cash-in-Transit | Prominent Enterprise' }

export default async function CashInTransitPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, POS_PERMISSIONS.CASH_IN_TRANSIT_READ)) {
    redirect('/403')
  }

  const canManage = can(session, POS_PERMISSIONS.CASH_IN_TRANSIT_MANAGE)

  // A branch-assigned caller (Branch Manager) is restricted to their own
  // branch server-side too (BankAccountsService.clearCashInTransit() and
  // SessionsService.getCashInTransitReport() both force this regardless of
  // what's submitted).
  const restrictedBranchId = session.branchId ?? null

  return <CashInTransitList canManage={canManage} restrictedBranchId={restrictedBranchId} />
}
