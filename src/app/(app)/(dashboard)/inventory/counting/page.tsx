import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { CountingHub } from './_components/CountingHub'

export const metadata = {
  title: 'Counting | Prominent Enterprise',
  description:
    'Stock counts, cycle schedules, mobile counting, batches, serial numbers, and expiry tracking',
}

export default async function CountingPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')

  const hasAccess = canAny(session, [
    INVENTORY_PERMISSIONS.STOCK_COUNT_READ,
    INVENTORY_PERMISSIONS.CYCLE_COUNT_READ,
    INVENTORY_PERMISSIONS.MOBILE_COUNT_USE,
    INVENTORY_PERMISSIONS.BATCH_READ,
    INVENTORY_PERMISSIONS.SERIAL_READ,
    INVENTORY_PERMISSIONS.EXPIRY_READ,
  ])

  if (!hasAccess) redirect('/403')

  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <CountingHub session={session} />
    </Suspense>
  )
}
