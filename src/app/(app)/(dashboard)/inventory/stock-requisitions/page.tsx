import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import BsrList from './_components/BsrList'

export const metadata = {
  title: 'Stock Requisitions | Prominent Enterprise',
  description: 'Branch stock requests with quantity reservation',
}

export default async function StockRequisitionsPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.STOCK_REQUISITIONS_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <BsrList session={session} />
    </div>
  )
}
