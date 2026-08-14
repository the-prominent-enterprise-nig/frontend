'use client'

import { useSearchParams } from 'next/navigation'
import { InventoryTabNav, type InventoryTab } from '@/src/components/inventory/InventoryTabNav'
import { PurchaseOrderList } from './PurchaseOrderList'
import { PurchaseRequestList } from '../../purchase-requests/_components/PurchaseRequestList'
import type { SessionUser } from '@/src/libs/guards/permission'

export function ProcurementHub({
  session,
  canReadOrders,
  canReadRequests,
  canCreate,
  canApprove,
  canSend,
  canCancel,
  canClose,
  canReceive,
  canViewCost,
  currentUserBranchId,
}: {
  session: SessionUser
  canReadOrders: boolean
  canReadRequests: boolean
  canCreate: boolean
  canApprove: boolean
  canSend: boolean
  canCancel: boolean
  canClose: boolean
  canReceive: boolean
  canViewCost: boolean
  currentUserBranchId?: string | null
}) {
  const searchParams = useSearchParams()

  const TABS: InventoryTab[] = [
    ...(canReadOrders ? [{ id: 'orders', label: 'Purchase Orders' }] : []),
    ...(canReadRequests ? [{ id: 'requests', label: 'Purchase Requests' }] : []),
  ]

  // Resolve against actual permission, not just the URL — a `?tab=` param
  // pointing at a tab the caller can't read must fall back to one they can,
  // never render the gated tab's content.
  const requestedTab = searchParams.get('tab')
  const tab =
    requestedTab === 'requests' && canReadRequests
      ? 'requests'
      : requestedTab === 'orders' && canReadOrders
        ? 'orders'
        : TABS[0]?.id

  return (
    <div className="min-h-screen bg-zinc-50/60">
      <InventoryTabNav tabs={TABS} />
      {tab === 'requests' ? (
        <PurchaseRequestList session={session} />
      ) : (
        <PurchaseOrderList
          canCreate={canCreate}
          canApprove={canApprove}
          canSend={canSend}
          canCancel={canCancel}
          canClose={canClose}
          canReceive={canReceive}
          canViewCost={canViewCost}
          currentUserBranchId={currentUserBranchId}
        />
      )}
    </div>
  )
}
