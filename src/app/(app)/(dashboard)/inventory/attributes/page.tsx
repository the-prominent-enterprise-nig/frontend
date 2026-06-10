import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { AttributesPageView } from './_components'

export const metadata = {
  title: 'Item Attributes | Prominent Enterprise',
  description: 'Create and manage custom attributes for inventory items',
}

export default async function AttributesPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.ATTRIBUTES_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <AttributesPageView session={session} />
    </div>
  )
}
