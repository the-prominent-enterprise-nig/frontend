import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import { PurchaseOrderList } from './_components/PurchaseOrderList'

export const metadata = {
  title: 'Purchase Orders | Prominent Enterprise',
  description: 'View and manage purchase orders',
}

export default async function PurchaseOrdersPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, PROCUREMENT_PERMISSIONS.PO_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <PurchaseOrderList />
    </div>
  )
}
