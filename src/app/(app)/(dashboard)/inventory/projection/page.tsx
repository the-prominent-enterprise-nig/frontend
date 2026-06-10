import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { ProjectionPageView } from './_components'

export const metadata = {
  title: 'Stock Projection | Prominent Enterprise',
  description: 'View forward stock projections based on demand and supply schedules',
}

export default async function ProjectionPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.PROJECTION_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <ProjectionPageView session={session} />
    </div>
  )
}
