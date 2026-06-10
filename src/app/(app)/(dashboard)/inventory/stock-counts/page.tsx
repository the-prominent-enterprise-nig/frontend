import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { StockCountList } from './_components'

export const metadata = {
  title: 'Stock Counts | Prominent Enterprise',
  description: 'Manage stock count sessions, review variances, and post adjustments',
}

export default async function StockCountsPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.STOCK_COUNT_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <StockCountList session={session} />
    </div>
  )
}
