'use client'

import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '@/src/components/ui/toast'
import type { ApiResponse } from '@/src/libs/api/client'
import type { CreateTransferFormValues } from '@/src/schema/inventory/transfers'
import { createCaravan } from '../../transfers/_actions/create-caravan'
import { createTransfer } from '../../transfers/_actions/create-transfer'

type ConsignResult = ApiResponse<{ transferNumber?: string }>

const REFRESHED_QUERIES = [
  'inventory-serial-numbers',
  'inventory-serial-status-count',
  'inventory-caravan-item-groups',
  'inventory-warehouses-lookup',
  'inventory-transfers',
  'inventory-transfers-count',
]

/**
 * Scenario 60 — "Consign to Caravan" from ticked serials. A caravan is
 * stocked by an ordinary Stock Transfer, so this creates the caravan and then
 * a transfer into its warehouse, one line per ticked unit pinned to that
 * serial. If the transfer fails the caravan stays; its stock can still be
 * sent from New Stock Transfer.
 */
async function consign(data: CreateTransferFormValues): Promise<ConsignResult> {
  if (!data.newCaravan) return { success: false, message: 'Enter the caravan details' }
  const caravan = await createCaravan(data.newCaravan)
  if (!caravan.success || !caravan.data) return { ...caravan, data: undefined }
  return createTransfer({
    ...data,
    toWarehouseId: caravan.data.warehouseId,
    newCaravan: undefined,
    lines: data.lines.map((l) => ({
      itemId: l.itemId,
      quantity: 1,
      serialNumberId: l.serialNumberId,
    })),
    expectedArrival: data.expectedArrival || undefined,
    reason: data.reason?.trim() || undefined,
  })
}

export function useConsignToCaravan(onDone: () => void): {
  consignToCaravan: (data: CreateTransferFormValues) => Promise<ConsignResult>
  isConsigning: boolean
} {
  const queryClient = useQueryClient()
  const router = useRouter()
  const mutation = useMutation({
    mutationFn: consign,
    onSuccess: (result) => {
      if (!result.success) {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
        return
      }
      const number = result.data?.transferNumber
      showToast({
        title: 'Consigned to caravan',
        description: number
          ? `${number} raised — track it through approval, dispatch and receiving.`
          : 'A stock transfer to the new caravan was raised.',
        status: 'success',
        action: number
          ? {
              label: 'View transfer',
              onClick: () =>
                router.push(`/inventory/transfers?transfer=${encodeURIComponent(number)}`),
            }
          : undefined,
      })
      REFRESHED_QUERIES.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }))
      onDone()
    },
  })
  return { consignToCaravan: mutation.mutateAsync, isConsigning: mutation.isPending }
}
