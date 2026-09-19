import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import PosCustomerDetail from '../_components/PosCustomerDetail'

export const metadata = { title: 'Customer | POS' }

export default async function PosCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, POS_PERMISSIONS.CUSTOMERS_READ)) redirect('/403')

  const { id } = await params

  return <PosCustomerDetail id={id} canUpdate={can(session, POS_PERMISSIONS.CUSTOMERS_UPDATE)} />
}
