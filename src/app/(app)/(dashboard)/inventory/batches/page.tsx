import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { BatchList } from './_components'

export const metadata = {
  title: 'Batch Tracking | Prominent Enterprise',
  description: 'Manage batches, track expiry, and apply quality holds',
}

export default async function BatchesPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.BATCH_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <BatchList session={session} />
    </div>
  )
}
