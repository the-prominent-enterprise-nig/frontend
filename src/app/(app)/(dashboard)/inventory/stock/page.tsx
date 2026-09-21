import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { StockHub } from './_components/StockHub'

export const metadata = {
  title: 'Stock | Prominent Enterprise',
  description: 'Real-time stock balances, reservations, and negative stock policies',
}

export default async function StockPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')
  // RECEIVE_READ joins STOCKS_READ because Receiving moved here from the
  // Operations hub, whose gate accepted it. Without this a receive-only user
  // would be 403'd out of a screen they can reach today. No data boundary
  // moves with it — GET /inventory/stock/balances carries no @RequirePermissions
  // server-side, so this was only ever a page guard.
  const hasAccess = canAny(session, [
    INVENTORY_PERMISSIONS.STOCKS_READ,
    INVENTORY_PERMISSIONS.RECEIVE_READ,
  ])

  if (!hasAccess) redirect('/403')

  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <StockHub session={session} />
    </Suspense>
  )
}
