import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import ReceiveGoodsForm from './_components/ReceiveGoodsForm'

export const metadata = { title: 'Receive Goods | Procurement' }

export default async function ReceiveGoodsPage({
  searchParams,
}: {
  searchParams: Promise<{ poId?: string }>
}) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, PROCUREMENT_PERMISSIONS.GR_CREATE)) redirect('/403')

  const { poId } = await searchParams
  if (!poId) redirect('/procurement/purchase-orders?status=sent')

  return (
    <ReceiveGoodsForm
      poId={poId}
      tenantId={session.enterpriseOwnerId ?? session.id}
      currentUserId={session.id}
    />
  )
}
