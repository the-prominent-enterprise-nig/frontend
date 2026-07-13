'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { STALE } from '@/src/libs/query/stale-times'
import { getPurchaseOrders } from '../_actions/get-purchase-orders'
import { createPurchaseOrder } from '../_actions/create-purchase-order'
import { convertPrToPo } from '../_actions/convert-pr-to-po'
import { approvePurchaseOrder } from '../_actions/approve-purchase-order'
import { sendPurchaseOrder } from '../_actions/send-purchase-order'
import { cancelPurchaseOrder } from '../_actions/cancel-purchase-order'
import { closePurchaseOrder } from '../_actions/close-purchase-order'
import type {
  ConvertPrToPoFormValues,
  CreatePoFormValues,
} from '@/src/schema/inventory/purchase-orders'

export function usePurchaseOrders() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')

  const queryParams = useMemo(
    () => ({ page, limit, status: statusFilter, search: search || undefined }),
    [page, limit, statusFilter, search]
  )

  const listQuery = useQuery({
    queryKey: ['purchase-orders', queryParams],
    queryFn: () => getPurchaseOrders(queryParams),
    placeholderData: keepPreviousData,
    staleTime: STALE.OPERATIONAL,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreatePoFormValues) => createPurchaseOrder(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Purchase order created',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      } else {
        showToast({
          title: 'Failed to create purchase order',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const convertMutation = useMutation({
    mutationFn: ({ prId, data }: { prId: string; data: ConvertPrToPoFormValues }) =>
      convertPrToPo(prId, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Purchase order created',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
        queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      } else {
        showToast({
          title: 'Failed to create purchase order',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvePurchaseOrder(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Purchase order approved',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      } else {
        showToast({
          title: 'Failed to approve purchase order',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const sendMutation = useMutation({
    mutationFn: (id: string) => sendPurchaseOrder(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Purchase order sent', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      } else {
        showToast({
          title: 'Failed to send purchase order',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const closeMutation = useMutation({
    mutationFn: (id: string) => closePurchaseOrder(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Purchase order closed',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      } else {
        showToast({
          title: 'Failed to close purchase order',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => cancelPurchaseOrder(id, reason),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Purchase order cancelled',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      } else {
        showToast({
          title: 'Failed to cancel purchase order',
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

    search,
    setSearch: (v: string) => {
      setSearch(v)
      setPage(1)
    },

    page,
    setPage,

    createPO: (data: CreatePoFormValues) => createMutation.mutateAsync(data),
    isCreating: createMutation.isPending,

    convertFromPr: (prId: string, data: ConvertPrToPoFormValues) =>
      convertMutation.mutateAsync({ prId, data }),
    isConverting: convertMutation.isPending,

    approvePO: approveMutation.mutateAsync,
    isApproving: approveMutation.isPending,

    sendPO: sendMutation.mutateAsync,
    isSending: sendMutation.isPending,

    closePO: closeMutation.mutateAsync,
    isClosing: closeMutation.isPending,

    cancelPO: ({ id, reason }: { id: string; reason: string }) =>
      cancelMutation.mutateAsync({ id, reason }),
    isCancelling: cancelMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }),
  }
}
