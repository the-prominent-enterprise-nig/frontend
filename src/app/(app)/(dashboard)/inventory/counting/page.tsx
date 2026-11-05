import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { CountingHub } from './_components/CountingHub'

export const metadata = {
  title: 'Counting | NIG Central',
  description: 'Stock adjustments, mobile counting and batches',
}

/** Where Stock Counts lives now: Stock Report → Physical Inventory (Scenario 87). */
const PHYSICAL_INVENTORY_HREF = '/inventory/reports?tab=physical-inventory'

export default async function CountingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')

  // Old links: the bare hub and its Stock Counts tab both meant the count list.
  const { tab } = await searchParams
  if (!tab || tab === 'counts') redirect(PHYSICAL_INVENTORY_HREF)

  const hasAccess = canAny(session, [
    INVENTORY_PERMISSIONS.STOCK_COUNT_READ,
    INVENTORY_PERMISSIONS.MOBILE_COUNT_USE,
    INVENTORY_PERMISSIONS.BATCH_READ,
    INVENTORY_PERMISSIONS.SERIAL_READ,
    INVENTORY_PERMISSIONS.STOCK_ADJUST,
    INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_CONFIRM,
    INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_INVESTIGATE,
    INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_APPROVE,
  ])

  if (!hasAccess) redirect('/403')

  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <CountingHub session={session} />
    </Suspense>
  )
}
