import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny, can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { CostingPageView } from './_components'

export const metadata = {
  title: 'Costing & COGS | Prominent Enterprise',
  description: 'Stock valuation and COGS management',
}

export default async function CostingPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  const canAccess = canAny(session, [
    INVENTORY_PERMISSIONS.COSTING_READ,
    INVENTORY_PERMISSIONS.COSTING_CONFIGURE,
  ])

  if (!canAccess && !can(session, INVENTORY_PERMISSIONS.WILDCARD)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <CostingPageView session={session} />
    </div>
  )
}
