import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { QualityHoldList } from './_components'

export const metadata = {
  title: 'Quality Hold | Prominent Enterprise',
  description:
    'Manage batches on quality hold — inspect, release, partially release, or reject with full traceability',
}

export default async function QualityHoldPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.STOCKS_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <QualityHoldList session={session} />
    </div>
  )
}
