'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { CreateTransferFormValues } from '@/src/schema/inventory/transfers'
import { useCreateStockRequest } from '../_hooks/useCreateStockRequest'
import CreateTransferModal from './CreateTransferModal'

const TRANSFERS_TAB = '/inventory/stock-transaction?tab=transfers'

// Stock Transaction's Stock Request tab — the New Stock Request form shown
// inline, with no Clear button. Submitting remounts it blank and goes to the
// Stock Transfer tab with the new request open, so the requester sees where
// it landed.
export default function StockRequestTab({ session }: { session: SessionUser }): React.JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formKey, setFormKey] = useState(0)
  // Item 360's "Stock Request" names the item, so the request opens on it.
  // Submitting navigates away, which drops these params with it.
  // Memoized: the form resets whenever initialDraft's identity changes.
  const prefillItemId = searchParams.get('item')
  const prefillItemLabel = searchParams.get('itemLabel')
  const initialDraft = useMemo(
    () =>
      prefillItemId
        ? { itemId: prefillItemId, itemLabel: prefillItemLabel ?? undefined, quantity: 1 }
        : null,
    [prefillItemId, prefillItemLabel]
  )
  const {
    warehouseOptions,
    branchOptions,
    createTransfer,
    isCreating,
    createCaravan,
    isCreatingCaravan,
  } = useCreateStockRequest()
  // A warehouse branch's staff (Negros / Panay Warehouse) own the standalone
  // warehouse of their region rather than a warehouse of their own branch —
  // same rule TransferList and the backend apply.
  const ownBranch = branchOptions.find((b) => b.id === session.branchId)
  const currentUserRegion = ownBranch?.type === 'warehouse' ? (ownBranch.region ?? null) : null

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
      initialDraft={initialDraft}
      onClose={() => setFormKey((k) => k + 1)}
      onSubmit={submit}
      isSubmitting={isCreating}
      onCreateCaravan={createCaravan}
      isCreatingCaravan={isCreatingCaravan}
      canCreateCaravan={hasPermission(session, INVENTORY_PERMISSIONS.CARAVAN_MANAGE)}
      warehouses={warehouseOptions}
      currentUserBranchId={session.branchId}
      currentUserRegion={currentUserRegion}
      // Deliberately not set: a stock request is always for the requester's
      // own branch (To locks to it), a Warehouse Custodian's Panay / Negros
      // warehouse included — they pick who to ask in From.
      canSkipApproval={hasPermission(session, INVENTORY_PERMISSIONS.TRANSFERS_DIRECT)}
    />
  )
}
