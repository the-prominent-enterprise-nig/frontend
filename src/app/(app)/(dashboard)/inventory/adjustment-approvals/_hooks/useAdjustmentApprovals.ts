'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getAdjustments } from '../_actions/get-adjustments'
import { confirmAdjustment } from '../_actions/confirm-adjustment'
import { startInvestigation } from '../_actions/start-investigation'
import { approveAdjustment } from '../_actions/approve-adjustment'
import { rejectAdjustment } from '../_actions/reject-adjustment'
import { withdrawAdjustment } from '../_actions/withdraw-adjustment'
import type {
  AdjustmentStatus,
  RejectAdjustmentFormValues,
} from '@/src/schema/inventory/adjustments'

export function useAdjustmentApprovals() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [statusFilter, setStatusFilter] = useState<AdjustmentStatus | undefined>(undefined)

  const queryParams = useMemo(
    () => ({ page, limit, status: statusFilter }),
    [page, limit, statusFilter]
  )

  const adjustmentsQuery = useQuery({
    queryKey: ['inventory-adjustment-approvals', queryParams],
    queryFn: () => getAdjustments(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 15 * 1000,
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['inventory-adjustment-approvals'] })
  }

  const confirmMutation = useMutation({
    mutationFn: (id: string) => confirmAdjustment(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Confirmed', description: result.message, status: 'success' })
        invalidate()
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const investigateMutation = useMutation({
    mutationFn: (id: string) => startInvestigation(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Investigation started',
          description: result.message,
          status: 'success',
        })
        invalidate()
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveAdjustment(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Approved', description: result.message, status: 'success' })
        invalidate()
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectAdjustmentFormValues }) =>
      rejectAdjustment(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Rejected', description: result.message, status: 'success' })
        invalidate()
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const withdrawMutation = useMutation({
    mutationFn: (id: string) => withdrawAdjustment(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Withdrawn', description: result.message, status: 'success' })
        invalidate()
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

    statusFilter,
    setStatusFilter: (v: AdjustmentStatus | undefined) => {
      setStatusFilter(v)
      setPage(1)
    },

    page,
    setPage,

    confirm: confirmMutation.mutateAsync,
    isConfirming: confirmMutation.isPending,

    startInvestigation: investigateMutation.mutateAsync,
    isInvestigating: investigateMutation.isPending,

    approve: approveMutation.mutateAsync,
    isApproving: approveMutation.isPending,

    reject: rejectMutation.mutateAsync,
    isRejecting: rejectMutation.isPending,

    withdraw: withdrawMutation.mutateAsync,
    isWithdrawing: withdrawMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-adjustment-approvals'] }),
  }
}
