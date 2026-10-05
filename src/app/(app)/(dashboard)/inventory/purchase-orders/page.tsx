import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { ProcurementHub } from './_components/ProcurementHub'
import { getProcurementHubPermissions } from './_permissions/procurement-hub-permissions'

export const metadata = {
  title: 'Purchase Orders | NIG Central',
  description: 'View and manage purchase orders and purchase requests',
}

export default async function PurchaseOrdersPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  const permissions = getProcurementHubPermissions(session)

  if (!permissions.canReadOrders && !permissions.canReadRequests) {
    redirect('/403')
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <ProcurementHub session={session} {...permissions} currentUserBranchId={session.branchId} />
    </Suspense>
  )
}
