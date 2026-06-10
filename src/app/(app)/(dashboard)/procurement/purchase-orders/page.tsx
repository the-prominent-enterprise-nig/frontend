import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import PurchaseOrdersList from './_components/PurchaseOrdersList'

export const metadata = { title: 'Purchase Orders | Procurement' }

export default async function PurchaseOrdersPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, PROCUREMENT_PERMISSIONS.PO_READ)) redirect('/403')

  return <PurchaseOrdersList canCreate={can(session, PROCUREMENT_PERMISSIONS.PO_CREATE)} />
}
