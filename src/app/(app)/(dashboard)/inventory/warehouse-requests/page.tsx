import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { WarehouseRequestList } from './_components'

export const metadata = {
  title: 'Warehouse Requests | Prominent Enterprise',
  description: 'Request stock from a real warehouse down to a branch',
}

export default async function WarehouseRequestsPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.WAREHOUSE_REQUESTS_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <WarehouseRequestList session={session} />
    </div>
  )
}
