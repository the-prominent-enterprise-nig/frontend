import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { PriceUseTypesPageView } from './_components'

export const metadata = {
  title: 'Price Use Types | Prominent Enterprise',
  description: 'Manage the price-use categories price lists are grouped under',
}

export default async function PriceUseTypesPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.PRICE_LISTS_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <PriceUseTypesPageView session={session} />
    </div>
  )
}
