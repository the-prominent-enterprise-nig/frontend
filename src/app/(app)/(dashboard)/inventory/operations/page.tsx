import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { OperationsHub } from './_components/OperationsHub'

export const metadata = {
  title: 'Operations | Prominent Enterprise',
  description: 'Stock transfers, returns, quality hold, and backorders',
}

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')

  // Receiving moved to the Stock hub. Sent on rather than left to fall
  // through to the Transfers default, which would land a stale bookmark
  // silently on an unrelated list. Targets the Receiving Reports tab rather
  // than Balance: what someone following a receiving link wants is the
  // receipts and the button that creates one.
  //
  // Done here rather than in OperationsHub because that is a Client
  // Component, and this runs before the access check below — the redirect
  // shouldn't depend on holding an Operations permission the user may not
  // have once Receiving is no longer part of this hub.
  const { tab } = await searchParams
  if (tab === 'receiving') redirect('/inventory/stock?tab=reports')

  // RECEIVE_READ is deliberately absent: Receiving moved to the Stock hub,
  // so that permission alone would open a hub with no tab its holder can use.
  const hasAccess = canAny(session, [
    INVENTORY_PERMISSIONS.TRANSFERS_READ,
    INVENTORY_PERMISSIONS.RETURNS_READ,
    INVENTORY_PERMISSIONS.QUALITY_HOLD_READ,
    INVENTORY_PERMISSIONS.BACKORDERS_READ,
  ])

  if (!hasAccess) redirect('/403')

  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <OperationsHub session={session} />
    </Suspense>
  )
}
