import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import ReturnRefundApprovalsList from './_components/ReturnRefundApprovalsList'

export const metadata = {
  title: 'Return & Refund Approvals | Prominent Enterprise',
}

export default async function ReturnRefundApprovalsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, POS_PERMISSIONS.TRANSACTIONS_OVERRIDE)) redirect('/403')

  const isManager = can(session, POS_PERMISSIONS.TRANSACTIONS_OVERRIDE)

  return <ReturnRefundApprovalsList isManager={isManager} />
}
