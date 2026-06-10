import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { StockLevelsPageView } from './_components'

export const metadata = {
  title: 'Stock Level Boundaries | Prominent Enterprise',
  description: 'Configure minimum and maximum stock level boundaries per item and warehouse',
}

export default async function StockLevelsPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.STOCK_LEVELS_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <StockLevelsPageView session={session} />
    </div>
  )
}
