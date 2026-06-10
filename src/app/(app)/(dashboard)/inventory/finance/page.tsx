import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { FinanceHub } from './_components/FinanceHub'

export const metadata = {
  title: 'Finance | Prominent Enterprise',
  description: 'Stock costing, price lists, landed costs, and inventory revaluation',
}

export default async function FinancePage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')

  const hasAccess = canAny(session, [
    INVENTORY_PERMISSIONS.COSTING_READ,
    INVENTORY_PERMISSIONS.PRICE_LISTS_READ,
    INVENTORY_PERMISSIONS.LANDED_COST_READ,
    INVENTORY_PERMISSIONS.REVALUATION_READ,
  ])

  if (!hasAccess) redirect('/403')

  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <FinanceHub session={session} />
    </Suspense>
  )
}
