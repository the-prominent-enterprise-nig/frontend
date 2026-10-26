import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { HubTabs } from '../_shared/HubTabs'
import { VehicleList } from './_components/VehicleList'

export const metadata = {
  title: 'Vehicles | NIG Central',
  description: 'The fleet roster by plate number, with each vehicle’s recorded expenses',
}

export default async function VehiclesPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')
  // Either the roster permission or the expense one — an accountant reads
  // vehicles here without holding transfers:read.
  if (
    !canAny(session, [INVENTORY_PERMISSIONS.TRANSFERS_READ, ACCOUNTING_PERMISSIONS.EXPENSE_READ])
  ) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <Suspense fallback={null}>
        <HubTabs hub="expenses" session={session} />
      </Suspense>
      <VehicleList session={session} />
    </div>
  )
}
