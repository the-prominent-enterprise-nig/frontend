import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { NegativeStockPageView } from './_components'

export const metadata = {
  title: 'Negative Stock Policy | Prominent Enterprise',
  description: 'Configure whether items are allowed to go below zero stock on hand',
}

export default async function NegativeStockPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.NEGATIVE_STOCK_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <NegativeStockPageView session={session} />
    </div>
  )
}
