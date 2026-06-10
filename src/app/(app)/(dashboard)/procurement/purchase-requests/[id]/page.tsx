import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import PurchaseRequestDetail from './_components/PurchaseRequestDetail'

export const metadata = { title: 'Purchase Request | Procurement' }

export default async function PurchaseRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, PROCUREMENT_PERMISSIONS.PR_READ)) redirect('/403')

  const { id } = await params
  return (
    <PurchaseRequestDetail
      id={id}
      currentUserId={session.id}
      canApprove={can(session, PROCUREMENT_PERMISSIONS.PR_APPROVE)}
      canReject={can(session, PROCUREMENT_PERMISSIONS.PR_REJECT)}
      canCancel={can(session, PROCUREMENT_PERMISSIONS.PR_CANCEL)}
      canCreatePo={can(session, PROCUREMENT_PERMISSIONS.PO_CREATE)}
    />
  )
}
