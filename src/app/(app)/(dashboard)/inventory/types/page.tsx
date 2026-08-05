import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { TypesPageView } from './_components'

export const metadata = {
  title: 'Item Types | Prominent Enterprise',
  description: 'Create and manage item types used to classify inventory items',
}

export default async function ItemTypesPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.ITEMS_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <TypesPageView session={session} />
    </div>
  )
}
