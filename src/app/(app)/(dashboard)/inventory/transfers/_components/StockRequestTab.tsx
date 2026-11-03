'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { CreateTransferFormValues } from '@/src/schema/inventory/transfers'
import { useCreateStockRequest } from '../_hooks/useCreateStockRequest'
import CreateTransferModal from './CreateTransferModal'

const TRANSFERS_TAB = '/inventory/stock-transaction?tab=transfers'

// Stock Transaction's Stock Request tab — the New Stock Request form shown
// inline. Clearing remounts it blank; submitting goes to the Stock Transfer
// tab with the new request open, so the requester sees where it landed.
export default function StockRequestTab({ session }: { session: SessionUser }): React.JSX.Element {
  const router = useRouter()
  const [formKey, setFormKey] = useState(0)
  const { warehouseOptions, createTransfer, isCreating, createCaravan, isCreatingCaravan } =
    useCreateStockRequest()

  async function submit(data: CreateTransferFormValues): ReturnType<typeof createTransfer> {
    const result = await createTransfer(data)
    if (result.success) {
      const number = result.data?.transferNumber
      router.push(
        number ? `${TRANSFERS_TAB}&transfer=${encodeURIComponent(number)}` : TRANSFERS_TAB
      )
    }
    return result
  }

  return (
    <CreateTransferModal
      key={formKey}
      variant="page"
      isOpen
      onClose={() => setFormKey((k) => k + 1)}
      onSubmit={submit}
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
