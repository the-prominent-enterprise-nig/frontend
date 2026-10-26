import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { HubTabs } from '../_shared/HubTabs'
import { DriverList } from './_components/DriverList'

export const metadata = {
  title: 'Drivers | NIG Central',
  description: 'The fleet roster: drivers, their plate numbers and branches',
}

export default async function DriversPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')
  if (!can(session, INVENTORY_PERMISSIONS.TRANSFERS_READ)) redirect('/403')

  return (
    <div className="min-h-screen bg-zinc-50">
      <Suspense fallback={null}>
        <HubTabs hub="expenses" session={session} />
      </Suspense>
      <DriverList session={session} />
    </div>
  )
}
