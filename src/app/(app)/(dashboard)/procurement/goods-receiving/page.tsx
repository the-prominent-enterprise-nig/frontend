import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import GoodsReceivingList from './_components/GoodsReceivingList'

export const metadata = { title: 'Goods Receiving | Procurement' }

export default async function GoodsReceivingPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, PROCUREMENT_PERMISSIONS.GR_READ)) redirect('/403')

  return <GoodsReceivingList canCreate={can(session, PROCUREMENT_PERMISSIONS.GR_CREATE)} />
}
