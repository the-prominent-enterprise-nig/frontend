import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { UomList } from './_components'

export const metadata = {
  title: 'Units of Measure | Prominent Enterprise',
  description:
    'Define base units and alternate units with conversion factors for purchasing and selling',
}

export default async function UomPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.ITEMS_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <UomList session={session} />
    </div>
  )
}
