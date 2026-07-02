'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { STALE } from '@/src/libs/query/stale-times'
import { getPurchaseRequests } from '../_actions/get-purchase-requests'
import { createPurchaseRequest } from '../_actions/create-purchase-request'
import { submitPurchaseRequest } from '../_actions/submit-purchase-request'
import { approvePurchaseRequest } from '../_actions/approve-purchase-request'
import { rejectPurchaseRequest } from '../_actions/reject-purchase-request'
import { cancelPurchaseRequest } from '../_actions/cancel-purchase-request'
import type {
  CreatePurchaseRequestFormValues,
  ApprovePrFormValues,
  RejectPrFormValues,
} from '@/src/schema/inventory/purchase-requests'

export function usePurchaseRequests() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)

  const queryParams = useMemo(
    () => ({ page, limit, status: statusFilter }),
    [page, limit, statusFilter]
  )

  const listQuery = useQuery({
    queryKey: ['purchase-requests', queryParams],
    queryFn: () => getPurchaseRequests(queryParams),
    placeholderData: keepPreviousData,
    staleTime: STALE.OPERATIONAL,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreatePurchaseRequestFormValues) => createPurchaseRequest(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Purchase request created',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      } else {
        showToast({
          title: 'Failed to create purchase request',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const submitMutation = useMutation({
    mutationFn: (id: string) => submitPurchaseRequest(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Purchase request submitted',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      } else {
        showToast({
          title: 'Failed to submit purchase request',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApprovePrFormValues }) =>
      approvePurchaseRequest(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Purchase request approved',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      } else {
        showToast({
          title: 'Failed to approve purchase request',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectPrFormValues }) =>
      rejectPurchaseRequest(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Purchase request rejected',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      } else {
        showToast({
          title: 'Failed to reject purchase request',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelPurchaseRequest(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Purchase request cancelled',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      } else {
        showToast({
          title: 'Failed to cancel purchase request',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const items = listQuery.data?.data?.data ?? []
  const pagination = {
    total: listQuery.data?.data?.total ?? 0,
    page: listQuery.data?.data?.page ?? 1,
    limit: listQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((listQuery.data?.data?.total ?? 0) / limit),
  }

  return {
    items,
    pagination,
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,

    statusFilter,
    setStatusFilter: (v: string | undefined) => {
      setStatusFilter(v)
      setPage(1)
    },

    page,
    setPage,

    createPR: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    submitPR: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,

    approvePR: (id: string, data: ApprovePrFormValues) => approveMutation.mutateAsync({ id, data }),
    isApproving: approveMutation.isPending,

    rejectPR: (id: string, data: RejectPrFormValues) => rejectMutation.mutateAsync({ id, data }),
    isRejecting: rejectMutation.isPending,

    cancelPR: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['purchase-requests'] }),
  }
}
