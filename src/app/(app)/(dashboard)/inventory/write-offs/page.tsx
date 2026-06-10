import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { WriteOffList } from './_components'

export const metadata = {
  title: 'Stock Write-offs | Prominent Enterprise',
  description:
    'Write off damaged, expired, or lost stock with documented reason and accounting impact',
}

export default async function WriteOffsPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.WRITE_OFFS_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <WriteOffList session={session} />
    </div>
  )
}
