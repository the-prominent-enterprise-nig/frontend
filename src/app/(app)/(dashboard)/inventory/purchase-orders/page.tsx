import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { ProcurementHub } from './_components/ProcurementHub'

export const metadata = {
  title: 'Purchase Orders | Prominent Enterprise',
  description: 'View and manage purchase orders and purchase requests',
}

export default async function PurchaseOrdersPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  const canReadOrders = can(session, PROCUREMENT_PERMISSIONS.PO_READ)
  const canReadRequests = can(session, PROCUREMENT_PERMISSIONS.PR_READ)

  if (!canReadOrders && !canReadRequests) {
    redirect('/403')
  }

  // The "+ New Purchase" button always drafts a Purchase Request now (there's
  // no more "skip the draft, create a live PO" path) — gate on PR_CREATE,
  // not PO_CREATE.
  const canCreate =
    can(session, PROCUREMENT_PERMISSIONS.PR_CREATE) ||
    can(session, PROCUREMENT_PERMISSIONS.WILDCARD)
  const canApprove =
    can(session, PROCUREMENT_PERMISSIONS.PO_APPROVE) ||
    can(session, PROCUREMENT_PERMISSIONS.WILDCARD)
  const canSend =
    can(session, PROCUREMENT_PERMISSIONS.PO_SEND) || can(session, PROCUREMENT_PERMISSIONS.WILDCARD)
  const canCancel =
    can(session, PROCUREMENT_PERMISSIONS.PO_CANCEL) ||
    can(session, PROCUREMENT_PERMISSIONS.WILDCARD)
  // PATCH /:id/close is gated server-side on PO_UPDATE, not a dedicated close permission
  const canClose =
    can(session, PROCUREMENT_PERMISSIONS.PO_UPDATE) ||
    can(session, PROCUREMENT_PERMISSIONS.WILDCARD)
  // "Receive stock" submits through the same inventory:receive:create-gated
  // endpoint as the standalone Goods Receiving flow — procurement:goods-receipts:*
  // isn't actually enforced anywhere server-side, so gate on the real permission.
  const canReceive =
    can(session, INVENTORY_PERMISSIONS.RECEIVE_CREATE) ||
    can(session, PROCUREMENT_PERMISSIONS.WILDCARD)
  // Unit cost is sensitive pricing data — restricted to Business
  // Owner/Accountant (Scenario 05 followup), same gate as the standalone
  // Goods Receiving flow.
  const canViewCost = can(session, INVENTORY_PERMISSIONS.COST_VIEW)

  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <ProcurementHub
        session={session}
        canReadOrders={canReadOrders}
        canReadRequests={canReadRequests}
        canCreate={canCreate}
        canApprove={canApprove}
        canSend={canSend}
        canCancel={canCancel}
        canClose={canClose}
        canReceive={canReceive}
        canViewCost={canViewCost}
        currentUserBranchId={session.branchId}
      />
    </Suspense>
  )
}
