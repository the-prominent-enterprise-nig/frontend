'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { STALE } from '@/src/libs/query/stale-times'
import { getPurchaseRequests } from '../_actions/get-purchase-requests'
import { createPurchaseRequest } from '../_actions/create-purchase-request'
import { updatePurchaseRequest } from '../_actions/update-purchase-request'
import { submitPurchaseRequest } from '../_actions/submit-purchase-request'
import { cancelPurchaseRequest } from '../_actions/cancel-purchase-request'
import type {
  CreatePurchaseRequestFormValues,
  UpdatePurchaseRequestFormValues,
} from '@/src/schema/inventory/purchase-requests'

export function usePurchaseRequests() {
  const queryClient = useQueryClient()
  const router = useRouter()

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
    // Scenario 26 — same gap found live in credit applications, item
    // master, and stock adjustments: an underspecified PR that stays at
    // 'submitted' still needs someone else (Branch Manager/Business Owner)
    // to manually convert it, across a different browser tab, and staleTime
    // alone only refetches on THIS tab's own refocus/remount, not when
    // someone else's action changes the record.
    refetchInterval: 10 * 1000,
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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePurchaseRequestFormValues }) =>
      updatePurchaseRequest(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Purchase request updated',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      } else {
        showToast({
          title: 'Failed to update purchase request',
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
          title: result.data?.convertedToPo
            ? 'Purchase request submitted and converted to a PO'
            : 'Purchase request submitted',
          description: result.message,
          status: 'success',
        })
        // A fully-specified PR auto-converts into a real PO in the same
        // request (PurchaseRequestService.submit() — no separate approval
        // step). The Purchase Orders tab's own cache has no way to know
        // that happened unless it's invalidated too, same as the explicit
        // convertFromPr mutation in usePurchaseOrders.ts already does.
        queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
        queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
        // The PR itself also drops out of the default (non-'converted')
        // list the instant this happens (purchase-request.service.ts's
        // findAll excludes status:'converted' by design) — follow it to
        // where it actually lives now instead of leaving the submitter
        // looking at a list it just vanished from.
        if (result.data?.convertedToPo) {
          router.replace('/inventory/purchase-orders?tab=orders')
        }
      } else {
        showToast({
          title: 'Failed to submit purchase request',
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

    updatePR: (id: string, data: UpdatePurchaseRequestFormValues) =>
      updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,

    submitPR: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,

    cancelPR: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['purchase-requests'] }),
  }
}
