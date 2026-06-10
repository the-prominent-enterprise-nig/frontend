'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getTransfers } from '../_actions/get-transfers'
import { getTransfer } from '../_actions/get-transfer'
import { createTransfer } from '../_actions/create-transfer'
import { dispatchTransfer } from '../_actions/dispatch-transfer'
import { receiveTransfer } from '../_actions/receive-transfer'
import { cancelTransfer } from '../_actions/cancel-transfer'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getItems } from '../../items/_actions/get-items'
import type {
  CreateTransferFormValues,
  DispatchTransferFormValues,
  ReceiveTransferFormValues,
  TransferStatus,
  TransferSummary,
} from '@/src/schema/inventory/transfers'

export function useTransferManager() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [statusFilter, setStatusFilter] = useState<TransferStatus | undefined>(undefined)
  const [fromWarehouseFilter, setFromWarehouseFilter] = useState<string | undefined>(undefined)
  const [toWarehouseFilter, setToWarehouseFilter] = useState<string | undefined>(undefined)
  const [selectedTransfer, setSelectedTransfer] = useState<TransferSummary | null>(null)

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      status: statusFilter,
      fromWarehouseId: fromWarehouseFilter,
      toWarehouseId: toWarehouseFilter,
    }),
    [page, limit, statusFilter, fromWarehouseFilter, toWarehouseFilter]
  )

  const transfersQuery = useQuery({
    queryKey: ['inventory-transfers', queryParams],
    queryFn: () => getTransfers(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })

  const transferDetailQuery = useQuery({
    queryKey: ['inventory-transfer', selectedTransfer?.id],
    queryFn: () => getTransfer(selectedTransfer!.id),
    enabled: !!selectedTransfer,
    staleTime: 30 * 1000,
  })

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  const itemsLookupQuery = useQuery({
    queryKey: ['inventory-items-lookup'],
    queryFn: () => getItems({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateTransferFormValues) => createTransfer(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Transfer saved as draft',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] })
      } else {
        showToast({
          title: 'Failed to create transfer',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const dispatchMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: DispatchTransferFormValues }) =>
      dispatchTransfer(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Transfer dispatched', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-transfer', selectedTransfer?.id] })
        if (selectedTransfer) {
          setSelectedTransfer((prev) => (prev ? { ...prev, status: 'in_transit' } : null))
        }
      } else {
        showToast({
          title: 'Failed to dispatch transfer',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const receiveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReceiveTransferFormValues }) =>
      receiveTransfer(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Transfer received', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-transfer', selectedTransfer?.id] })
        if (selectedTransfer) {
          setSelectedTransfer((prev) => (prev ? { ...prev, status: 'received' } : null))
        }
      } else {
        showToast({
          title: 'Failed to receive transfer',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelTransfer(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Transfer cancelled', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] })
        setSelectedTransfer(null)
      } else {
        showToast({
          title: 'Failed to cancel transfer',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const transfers = transfersQuery.data?.data?.data ?? []
  const pagination = {
    total: transfersQuery.data?.data?.total ?? 0,
    page: transfersQuery.data?.data?.page ?? 1,
    limit: transfersQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((transfersQuery.data?.data?.total ?? 0) / limit),
  }

  const warehouseOptions = warehousesQuery.data?.data?.data ?? []
  const itemOptions = itemsLookupQuery.data?.data?.data ?? []

  return {
    transfers,
    pagination,
    isLoading: transfersQuery.isLoading,
    isFetching: transfersQuery.isFetching,
    error: transfersQuery.error,

    statusFilter,
    fromWarehouseFilter,
    toWarehouseFilter,
    setStatusFilter: (v: typeof statusFilter) => {
      setStatusFilter(v)
      setPage(1)
    },
    setFromWarehouseFilter: (v: string | undefined) => {
      setFromWarehouseFilter(v)
      setPage(1)
    },
    setToWarehouseFilter: (v: string | undefined) => {
      setToWarehouseFilter(v)
      setPage(1)
    },
    resetFilters: () => {
      setStatusFilter(undefined)
      setFromWarehouseFilter(undefined)
      setToWarehouseFilter(undefined)
      setPage(1)
    },

    page,
    setPage,

    selectedTransfer,
    setSelectedTransfer,
    transferDetail: transferDetailQuery.data?.data ?? selectedTransfer,
    isLoadingDetail: transferDetailQuery.isLoading,

    warehouseOptions,
    itemOptions,

    createTransfer: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    dispatchTransfer: (id: string, data?: DispatchTransferFormValues) =>
      dispatchMutation.mutateAsync({ id, data }),
    isDispatching: dispatchMutation.isPending,

    receiveTransfer: (id: string, data: ReceiveTransferFormValues) =>
      receiveMutation.mutateAsync({ id, data }),
    isReceiving: receiveMutation.isPending,

    cancelTransfer: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] }),
  }
}
