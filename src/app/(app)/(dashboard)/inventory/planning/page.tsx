import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { PlanningHub } from './_components/PlanningHub'

export const metadata = {
  title: 'Planning | Prominent Enterprise',
  description: 'Reorder rules, stock level boundaries, and forward stock projection',
}

export default async function PlanningPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')

  const hasAccess = canAny(session, [
    INVENTORY_PERMISSIONS.REORDER_READ,
    INVENTORY_PERMISSIONS.STOCK_LEVELS_READ,
    INVENTORY_PERMISSIONS.PROJECTION_READ,
  ])

  if (!hasAccess) redirect('/403')

  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <PlanningHub session={session} />
    </Suspense>
  )
}
