import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { BackordersPageView } from './_components'

export const metadata = {
  title: 'Backorders | Prominent Enterprise',
  description: 'Track and manage backorder records for out-of-stock items',
}

export default async function BackordersPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.BACKORDERS_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <BackordersPageView session={session} />
    </div>
  )
}
