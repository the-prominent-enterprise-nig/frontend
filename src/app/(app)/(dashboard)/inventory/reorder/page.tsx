import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { ReorderDashboard } from './_components'

export const metadata = {
  title: 'Reorder Management | Prominent Enterprise',
  description: 'Monitor low-stock alerts and configure automatic reorder thresholds',
}

export default async function ReorderPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.REORDER_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <ReorderDashboard session={session} />
    </div>
  )
}
