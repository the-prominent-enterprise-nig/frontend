import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
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
  // Scenario 29 PO-06/PO-08 — same PO_UPDATE permission as canClose above
  // (the edit PATCH and the close PATCH are the same endpoint/gate),
  // named separately for clarity at the two distinct UI call sites.
  const canEdit = canClose
  // "Receive stock" submits through the same inventory:receive:create-gated
  // endpoint as the standalone Goods Receiving flow — procurement:goods-receipts:*
  // isn't actually enforced anywhere server-side, so gate on the real permission.
  const canReceive =
    can(session, INVENTORY_PERMISSIONS.RECEIVE_CREATE) ||
    can(session, PROCUREMENT_PERMISSIONS.WILDCARD)
  // Unit cost is sensitive pricing data — restricted to Business
  // Owner/Accountant (Scenario 05 followup), same gate as the standalone
  // Goods Receiving flow.
  const canViewCost = can(session, INVENTORY_PERMISSIONS.RECEIVE_COST_VIEW)
  // Scenario 41 Part 3 — gates the "View Invoice" link on a PO row so a
  // role without AP Invoices access doesn't get a link into a page it'll
  // then be denied on.
  const canViewApBill =
    can(session, ACCOUNTING_PERMISSIONS.AP_BILLS_READ) ||
    can(session, ACCOUNTING_PERMISSIONS.WILDCARD)

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
        canEdit={canEdit}
        canReceive={canReceive}
        canViewCost={canViewCost}
        canViewApBill={canViewApBill}
        currentUserBranchId={session.branchId}
      />
    </Suspense>
  )
}
