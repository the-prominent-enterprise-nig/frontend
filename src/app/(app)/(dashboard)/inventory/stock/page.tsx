import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { StockHub } from './_components/StockHub'

export const metadata = {
  title: 'Stock | Prominent Enterprise',
  description: 'Real-time stock balances, reservations, and negative stock policies',
}

export default async function StockPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')
  if (!can(session, INVENTORY_PERMISSIONS.STOCKS_READ)) redirect('/403')

  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <StockHub session={session} />
    </Suspense>
  )
}
