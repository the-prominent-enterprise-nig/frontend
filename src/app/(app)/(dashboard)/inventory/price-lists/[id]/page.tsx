import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { PriceListDetailPageView } from './_components/PriceListDetailPageView'

export const metadata = {
  title: 'Price List Items | Prominent Enterprise',
  description: 'Manage the priced items in a price list',
}

export default async function PriceListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.PRICE_LISTS_READ)) {
    redirect('/403')
  }

  const { id } = await params

  return (
    <div className="min-h-screen bg-zinc-50">
      <PriceListDetailPageView priceListId={id} session={session} />
    </div>
  )
}
