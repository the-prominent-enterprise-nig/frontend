'use client'

import { useState } from 'react'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { useCreateStockRequest } from '../_hooks/useCreateStockRequest'
import CreateTransferModal from './CreateTransferModal'

// Stock Transaction's Stock Request tab — the New Stock Request form shown
// inline. Submitting or clearing remounts it blank, ready for the next one;
// the submitted request then shows up under the Stock Transfer tab.
export default function StockRequestTab({ session }: { session: SessionUser }): React.JSX.Element {
  const [formKey, setFormKey] = useState(0)
  const { warehouseOptions, createTransfer, isCreating, createCaravan, isCreatingCaravan } =
    useCreateStockRequest()

  return (
    <CreateTransferModal
      key={formKey}
      variant="page"
      isOpen
      onClose={() => setFormKey((k) => k + 1)}
      onSubmit={createTransfer}
      isSubmitting={isCreating}
      onCreateCaravan={createCaravan}
      isCreatingCaravan={isCreatingCaravan}
      canCreateCaravan={hasPermission(session, INVENTORY_PERMISSIONS.CARAVAN_MANAGE)}
      warehouses={warehouseOptions}
      currentUserBranchId={session.branchId}
      canSkipApproval={hasPermission(session, INVENTORY_PERMISSIONS.TRANSFERS_DIRECT)}
    />
  )
}
