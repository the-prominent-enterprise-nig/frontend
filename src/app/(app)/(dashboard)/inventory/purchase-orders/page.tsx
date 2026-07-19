import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { PurchaseOrderList } from './_components/PurchaseOrderList'

export const metadata = {
  title: 'Purchase Orders | Prominent Enterprise',
  description: 'View and manage purchase orders',
}

export default async function PurchaseOrdersPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, PROCUREMENT_PERMISSIONS.PO_READ)) {
    redirect('/403')
  }

  const canCreate =
    can(session, PROCUREMENT_PERMISSIONS.PO_CREATE) ||
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

  return (
    <div className="min-h-screen bg-zinc-50">
      <PurchaseOrderList
        canCreate={canCreate}
        canApprove={canApprove}
        canSend={canSend}
        canCancel={canCancel}
        canClose={canClose}
        canReceive={canReceive}
      />
    </div>
  )
}
