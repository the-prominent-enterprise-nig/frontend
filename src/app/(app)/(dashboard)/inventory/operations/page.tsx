import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { OperationsHub } from './_components/OperationsHub'

export const metadata = {
  title: 'Operations | Prominent Enterprise',
  description:
    'Stock transfers, goods receiving, returns, write-offs, quality hold, and backorders',
}

export default async function OperationsPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')

  const hasAccess = canAny(session, [
    INVENTORY_PERMISSIONS.TRANSFERS_READ,
    INVENTORY_PERMISSIONS.RECEIVE_READ,
    INVENTORY_PERMISSIONS.RETURNS_READ,
    INVENTORY_PERMISSIONS.WRITE_OFFS_READ,
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
