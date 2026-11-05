import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { ReportsDashboard } from './_components'

export const metadata = {
  title: 'Stock Report | NIG Central',
  description: 'Aging of inventory and physical inventory',
}

/** Whoever can open at least one of the Stock Report's tabs (Scenario 87):
 * Aging of Inventory (turnover permission) or Physical Inventory (stock-count read). */
const STOCK_REPORT_PERMISSIONS = [
  INVENTORY_PERMISSIONS.REPORTS_TURNOVER,
  INVENTORY_PERMISSIONS.STOCK_COUNT_READ,
]

export default async function InventoryReportsPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!canAny(session, STOCK_REPORT_PERMISSIONS)) {
    redirect('/403')
  }

  // The tab strip reads ?tab=, so it needs a Suspense boundary.
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <ReportsDashboard session={session} />
    </Suspense>
  )
}
