'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import type { ApiResponse } from '@/src/libs/api/client'
import { getAdjustments } from '../_actions/get-adjustments'
import { confirmAdjustment } from '../_actions/confirm-adjustment'
import { investigateAdjustment } from '../_actions/investigate-adjustment'
import { approveAdjustment } from '../_actions/approve-adjustment'
import { rejectAdjustment } from '../_actions/reject-adjustment'
import { withdrawAdjustment } from '../_actions/withdraw-adjustment'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import type {
  AdjustmentDetail,
  AdjustmentStatus,
  RejectAdjustmentFormValues,
} from '@/src/schema/inventory/adjustments'

export function useAdjustments() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<AdjustmentStatus | undefined>(undefined)
  const [selectedAdjustment, setSelectedAdjustment] = useState<AdjustmentDetail | null>(null)

  const queryParams = useMemo(
    () => ({ page, limit, warehouseId: warehouseFilter, status: statusFilter }),
    [page, limit, warehouseFilter, statusFilter]
  )

  const adjustmentsQuery = useQuery({
    queryKey: ['inventory-stock-adjustments', queryParams],
    queryFn: () => getAdjustments(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    // Scenario 26 — same gap found live in credit applications and item
    // master (see useCreditApplications.ts): this is a 4-stage maker-checker
    // handoff across different people's browser tabs (Stock Controller
    // submits, Branch Manager confirms, Business Owner investigates then
    // approves), and it's exactly where a stock-adjustment notification's
    // click-through lands — staleTime alone only refetches on THIS tab's
    // own refocus/remount.
    refetchInterval: 10 * 1000,
  })

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  function onTransitionSuccess(result: ApiResponse<unknown>, successTitle: string) {
    if (result.success) {
      showToast({ title: successTitle, description: result.message, status: 'success' })
      queryClient.invalidateQueries({ queryKey: ['inventory-stock-adjustments'] })
      setSelectedAdjustment((prev) =>
        prev ? { ...prev, ...(result.data as Partial<AdjustmentDetail>) } : prev
      )
    } else {
      showToast({ title: 'Failed', description: result.message, status: 'error' })
    }
  }

  const confirmMutation = useMutation({
    mutationFn: (id: string) => confirmAdjustment(id),
    onSuccess: (result) => onTransitionSuccess(result, 'Adjustment confirmed'),
  })

  const investigateMutation = useMutation({
    mutationFn: (id: string) => investigateAdjustment(id),
    onSuccess: (result) => onTransitionSuccess(result, 'Moved to investigating'),
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveAdjustment(id),
    onSuccess: (result) => onTransitionSuccess(result, 'Adjustment approved'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectAdjustmentFormValues }) =>
      rejectAdjustment(id, data),
    onSuccess: (result) => onTransitionSuccess(result, 'Adjustment rejected'),
  })

  const withdrawMutation = useMutation({
    mutationFn: (id: string) => withdrawAdjustment(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Withdrawn', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-stock-adjustments'] })
        // Withdraw hard-deletes the row — unlike the other transitions,
        // there's nothing left to merge back into the open detail view.
        setSelectedAdjustment(null)
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const adjustments = adjustmentsQuery.data?.data?.data ?? []
  const pagination = {
    total: adjustmentsQuery.data?.data?.total ?? 0,
    page: adjustmentsQuery.data?.data?.page ?? 1,
    limit: adjustmentsQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((adjustmentsQuery.data?.data?.total ?? 0) / limit),
  }

  return {
    adjustments,
    pagination,
    isLoading: adjustmentsQuery.isLoading,
    isFetching: adjustmentsQuery.isFetching,
    error: adjustmentsQuery.error,

    warehouseFilter,
    statusFilter,
    setWarehouseFilter: (v: string | undefined) => {
      setWarehouseFilter(v)
      setPage(1)
    },
    setStatusFilter: (v: AdjustmentStatus | undefined) => {
      setStatusFilter(v)
      setPage(1)
    },
    resetFilters: () => {
      setWarehouseFilter(undefined)
      setStatusFilter(undefined)
      setPage(1)
    },

    page,
    setPage,

    selectedAdjustment,
    setSelectedAdjustment,

    warehouseOptions: warehousesQuery.data?.data?.data ?? [],

    confirm: confirmMutation.mutateAsync,
    isConfirming: confirmMutation.isPending,

    investigate: investigateMutation.mutateAsync,
    isInvestigating: investigateMutation.isPending,

    approve: approveMutation.mutateAsync,
    isApproving: approveMutation.isPending,

    reject: rejectMutation.mutateAsync,
    isRejecting: rejectMutation.isPending,

    withdraw: withdrawMutation.mutateAsync,
    isWithdrawing: withdrawMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-stock-adjustments'] }),
  }
}
