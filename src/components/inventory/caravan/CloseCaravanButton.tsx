'use client'

import { useState } from 'react'
import { CircleStop } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '@/src/components/ui/Modal'
import Tooltip from '@/src/components/ui/Tooltip'
import { showToast } from '@/src/components/ui/toast'
import { closeCaravan } from '@/src/app/(app)/(dashboard)/inventory/transfers/_actions/close-caravan'
import type { WarehouseBranch } from '@/src/schema/inventory/warehouses'

// Everything that shows a caravan's details or running/ended state.
export const CARAVAN_QUERIES = [
  'caravan-alerts',
  'inventory-warehouses-lookup',
  'inventory-caravan-item-groups',
  'inventory-serial-numbers',
]

function useCloseCaravan(onDone: () => void): {
  close: (id: string) => void
  isClosing: boolean
} {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: closeCaravan,
    onSuccess: (result) => {
      if (!result.success) {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
        return
      }
      showToast({ title: 'Caravan closed', status: 'success' })
      CARAVAN_QUERIES.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }))
      onDone()
    },
  })
  return { close: mutation.mutate, isClosing: mutation.isPending }
}

/**
 * Head office closes a caravan once everything in it has been transferred
 * out — before or after its end date. The caller decides who sees it (head
 * office only); it stays disabled while units remain. Renders nothing for a
 * caravan that is already closed.
 */
export default function CloseCaravanButton({
  caravan,
  unitsLeft,
}: {
  caravan: WarehouseBranch | null | undefined
  // Units still at the caravan or on their way out of it.
  unitsLeft: number
}): React.ReactElement | null {
  const [confirming, setConfirming] = useState(false)
  const { close, isClosing } = useCloseCaravan(() => setConfirming(false))
  if (!caravan?.isTemporary || caravan.closedAt) return null

  const blocked = unitsLeft > 0
  return (
    <>
      <Tooltip
        label={
          blocked
            ? `Transfer out all ${unitsLeft.toLocaleString()} remaining unit${unitsLeft === 1 ? '' : 's'} first`
            : 'Close this caravan for good'
        }
        side="bottom"
        align="end"
      >
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={blocked}
          aria-label="Close caravan"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#f3c9c5] bg-white text-[#b42318] hover:bg-[#fdeceb] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
        >
          <CircleStop className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
      <ConfirmDialog
        open={confirming}
        title="Close this caravan?"
        message={`${caravan.eventName ?? caravan.name} is closed for good — no stock can be sent to it and nothing can be sold there. It stays listed as closed. This can't be undone.`}
        confirmLabel="Close caravan"
        destructive
        loading={isClosing}
        onConfirm={() => close(caravan.id)}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
