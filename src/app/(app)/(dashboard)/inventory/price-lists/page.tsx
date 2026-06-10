import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { PriceListsPageView } from './_components'

export const metadata = {
  title: 'Price Lists | Prominent Enterprise',
  description: 'Manage item price lists and pricing tiers',
}

export default async function PriceListsPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.PRICE_LISTS_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <PriceListsPageView session={session} />
    </div>
  )
}
