import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { BrandsPageView } from './_components'

export const metadata = {
  title: 'Item Brands | Prominent Enterprise',
  description: 'Create and manage brands used to classify inventory items',
}

export default async function BrandsPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.ITEMS_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <BrandsPageView session={session} />
    </div>
  )
}
