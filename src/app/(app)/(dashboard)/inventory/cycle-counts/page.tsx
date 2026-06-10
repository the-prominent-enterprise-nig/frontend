import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { CycleCountList } from './_components'

export const metadata = {
  title: 'Cycle Counts | Prominent Enterprise',
  description: 'Plan, track, and complete periodic cycle count sessions',
}

export default async function CycleCountsPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.CYCLE_COUNT_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <CycleCountList session={session} />
    </div>
  )
}
