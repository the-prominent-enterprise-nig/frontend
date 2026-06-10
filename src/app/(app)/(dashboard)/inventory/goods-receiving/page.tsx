import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { GoodsReceivingList } from './_components'

export const metadata = {
  title: 'Goods Receiving | Prominent Enterprise',
  description: 'Receive incoming stock and update inventory balances',
}

export default async function GoodsReceivingPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.RECEIVE_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <GoodsReceivingList session={session} />
    </div>
  )
}
