import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { LandedCostPageView } from './_components'

export const metadata = {
  title: 'Landed Costs | Prominent Enterprise',
  description: 'Record and allocate additional landed costs on goods receipts',
}

export default async function LandedCostPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.LANDED_COST_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <LandedCostPageView session={session} />
    </div>
  )
}
