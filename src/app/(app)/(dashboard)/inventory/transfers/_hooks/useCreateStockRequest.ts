'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '@/src/components/ui/toast'
import { createTransfer } from '../_actions/create-transfer'
import { createCaravan } from '../_actions/create-caravan'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getBranches, type BranchLookup } from '../_actions/get-branches'
import type {
  CreateTransferFormValues,
  NewCaravanFormValues,
} from '@/src/schema/inventory/transfers'
import type { WarehouseSummary } from '@/src/schema/inventory/warehouses'
import type { ApiResponse } from '@/src/libs/api/client'

type CreateStockRequest = {
  warehouseOptions: WarehouseSummary[]
  /** Branch lookup — gives a warehouse branch's region, which is how its
   * staff are matched to the standalone warehouse their stock sits in. */
  branchOptions: BranchLookup[]
  createTransfer: (
    data: CreateTransferFormValues
  ) => Promise<ApiResponse<{ id: string; transferNumber?: string }>>
  isCreating: boolean
  createCaravan: (data: NewCaravanFormValues) => Promise<ApiResponse<{ warehouseId: string }>>
  isCreatingCaravan: boolean
}

// The create side of stock transfers on its own — the warehouse lookup and
// the create mutations, without the list, counts and detail queries
// useTransferManager also runs. The Stock Request tab only needs this much.
export function useCreateStockRequest(): CreateStockRequest {
  const queryClient = useQueryClient()

  const warehousesQuery = useQuery({
    // Keyed apart from the bare ['inventory-warehouses-lookup'] every
    // branch-scoped picker shares — this list is deliberately wider, and
    // parking it under the shared key would hand other screens warehouses
    // outside the caller's branch for as long as it stays fresh.
    queryKey: ['inventory-warehouses-lookup', 'all-branches'],
    // allBranches: a transfer is inherently cross-branch — the create
    // modal's "From Branch" picker needs every branch, not just the
    // caller's own. Safe to always request: the backend only honors this
    // for callers cleared for cross-branch work (see
    // warehouses.controller.ts), silently ignoring it otherwise.
    queryFn: () => getWarehouses({ limit: 200, status: 'active', allBranches: true }),
    staleTime: 5 * 60 * 1000,
  })

  // Same key as useTransferManager's, so the two share one request.
  const branchesQuery = useQuery({
    queryKey: ['inventory-branches-lookup'],
    queryFn: () => getBranches(),
    staleTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateTransferFormValues) => createTransfer(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Transfer request submitted',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-uds'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-serial-numbers'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-transfers-count'] })
      } else {
        showToast({
          title: 'Failed to create transfer',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  // Scenario 60 Part 2 — a caravan created inline from New Stock Transfer.
  // Refreshes the warehouse list so the new caravan is pickable at once,
  // including when the transfer after it fails and the user retries.
  const createCaravanMutation = useMutation({
    mutationFn: (data: NewCaravanFormValues) => createCaravan(data),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['inventory-warehouses-lookup'] })
      } else {
        showToast({
          title: 'Failed to create the caravan',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  return {
    warehouseOptions: warehousesQuery.data?.data?.data ?? [],
    branchOptions: branchesQuery.data?.data?.data ?? [],
    createTransfer: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createCaravan: createCaravanMutation.mutateAsync,
    isCreatingCaravan: createCaravanMutation.isPending,
  }
}
