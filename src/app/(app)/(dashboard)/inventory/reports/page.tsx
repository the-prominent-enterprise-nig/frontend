import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { ReportsDashboard } from './_components'

export const metadata = {
  title: 'Inventory Reports | Prominent Enterprise',
  description: 'Stock valuation, turnover, and aging reports',
}

export default async function InventoryReportsPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (
    !canAny(session, [
      INVENTORY_PERMISSIONS.REPORTS_VALUATION,
      INVENTORY_PERMISSIONS.REPORTS_TURNOVER,
    ])
  ) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <ReportsDashboard session={session} />
    </div>
  )
}
