import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { WarehouseList } from './_components'

export const metadata = {
  title: 'Warehouses | Prominent Enterprise',
  description: 'Manage warehouses and storage sub-locations for stock tracking',
}

export default async function WarehousesPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.WAREHOUSES_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <WarehouseList session={session} />
    </div>
  )
}
