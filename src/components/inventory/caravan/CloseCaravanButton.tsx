'use client'

import { useState } from 'react'
import { CircleStop } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '@/src/components/ui/Modal'
import { showToast } from '@/src/components/ui/toast'
import { closeCaravan } from '@/src/app/(app)/(dashboard)/inventory/transfers/_actions/close-caravan'
import { isCaravanEnded, type WarehouseBranch } from '@/src/schema/inventory/warehouses'

// Everything that shows a caravan's running/ended state.
const REFRESHED_QUERIES = [
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
      showToast({
        title: 'Caravan closed',
        description: 'Transfer out any units still there.',
        status: 'success',
      })
      REFRESHED_QUERIES.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }))
      onDone()
    },
  })
  return { close: mutation.mutate, isClosing: mutation.isPending }
}

/**
 * The host branch ends a running caravan by hand instead of waiting for its
 * end date. Renders nothing for a caravan that has already ended.
 */
export default function CloseCaravanButton({
  caravan,
}: {
  caravan: WarehouseBranch | null | undefined
}): React.ReactElement | null {
  const [confirming, setConfirming] = useState(false)
  const { close, isClosing } = useCloseCaravan(() => setConfirming(false))
  if (!caravan?.isTemporary || isCaravanEnded(caravan)) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-[#f3c9c5] bg-white px-2.5 py-1 text-[12px] font-medium text-[#b42318] hover:bg-[#fdeceb]"
      >
        <CircleStop className="h-3.5 w-3.5" />
        Close caravan
      </button>
      <ConfirmDialog
        open={confirming}
        title="Close this caravan?"
        message={`${caravan.eventName ?? caravan.name} ends now. No new stock can be sent to it and its units can't be sold — transfer out whatever is still there. This can't be undone.`}
        confirmLabel="Close caravan"
        destructive
        loading={isClosing}
        onConfirm={() => close(caravan.id)}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
