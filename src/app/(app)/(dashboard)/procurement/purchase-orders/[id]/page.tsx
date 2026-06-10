import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import PurchaseOrderDetail from './_components/PurchaseOrderDetail'

export const metadata = { title: 'Purchase Order | Procurement' }

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, PROCUREMENT_PERMISSIONS.PO_READ)) redirect('/403')

  const { id } = await params
  return (
    <PurchaseOrderDetail
      id={id}
      canSend={can(session, PROCUREMENT_PERMISSIONS.PO_SEND)}
      canClose={can(session, PROCUREMENT_PERMISSIONS.PO_CLOSE)}
      canCancel={can(session, PROCUREMENT_PERMISSIONS.PO_CANCEL)}
      canReceive={can(session, PROCUREMENT_PERMISSIONS.GR_CREATE)}
    />
  )
}
