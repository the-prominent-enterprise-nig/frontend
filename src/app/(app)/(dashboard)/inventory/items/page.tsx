import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { ItemMasterList } from './_components'

export const metadata = {
  title: 'Item Master | Prominent Enterprise',
  description: 'Create and manage product records in the Item Master',
}

export default async function ItemMasterPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.ITEMS_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <ItemMasterList session={session} />
    </div>
  )
}
