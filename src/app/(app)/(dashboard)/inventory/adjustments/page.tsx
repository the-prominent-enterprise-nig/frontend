import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { AdjustmentList } from './_components'

export const metadata = {
  title: 'Stock Adjustments | Prominent Enterprise',
  description: 'Review stock adjustments through the confirm/investigate/approve chain',
}

export default async function AdjustmentsPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  const canView = canAny(session, [
    INVENTORY_PERMISSIONS.STOCK_ADJUST,
    INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_CONFIRM,
    INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_INVESTIGATE,
    INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_APPROVE,
  ])
  if (!canView) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <AdjustmentList session={session} />
    </div>
  )
}
