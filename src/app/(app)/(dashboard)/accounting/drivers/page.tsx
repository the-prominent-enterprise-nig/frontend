import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { HubTabs } from '../_shared/HubTabs'
import { DriverList } from './_components/DriverList'
import { DRIVER_ACCESS } from '@/src/libs/guards/shared-ownership'

export const metadata = {
  title: 'Drivers | NIG Central',
  description: 'The fleet roster: drivers, their plate numbers and branches',
}

export default async function DriversPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')
  if (!canAny(session, DRIVER_ACCESS.READ)) redirect('/403')

  return (
    <div className="min-h-screen bg-zinc-50">
      <Suspense fallback={null}>
        <HubTabs hub="expenses" session={session} />
      </Suspense>
      <DriverList session={session} />
    </div>
  )
}
