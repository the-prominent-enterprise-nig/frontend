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
import { approveHqTransfer } from '../_actions/approve-hq-transfer'
import { rejectHqTransfer } from '../_actions/reject-hq-transfer'
import { acceptTransfer } from '../_actions/accept-transfer'
import { rejectTransfer } from '../_actions/reject-transfer'
import { approveManagerTransfer } from '../_actions/approve-manager-transfer'
import { rejectManagerTransfer } from '../_actions/reject-manager-transfer'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import type {
  CreateTransferFormValues,
  DispatchTransferFormValues,
  ReceiveTransferFormValues,
  RejectHqTransferFormValues,
  RejectTransferFormValues,
  RejectManagerTransferFormValues,
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
      } else {
        showToast({
          title: 'Failed to create transfer',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const approveManagerMutation = useMutation({
    mutationFn: (id: string) => approveManagerTransfer(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Request approved', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-transfer', selectedTransfer?.id] })
        // No optimistic status set here — approving routes to either
        // 'requested' or 'pending_hq_approval' depending on the HQ-approval
        // toggle, so the refetch above is what actually reflects it.
      } else {
        showToast({
          title: 'Failed to approve request',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const rejectManagerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectManagerTransferFormValues }) =>
      rejectManagerTransfer(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Request rejected', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-transfer', selectedTransfer?.id] })
        if (selectedTransfer) {
          setSelectedTransfer((prev) => (prev ? { ...prev, status: 'rejected' } : null))
        }
      } else {
        showToast({
          title: 'Failed to reject request',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const approveHqMutation = useMutation({
    mutationFn: (id: string) => approveHqTransfer(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Request approved', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-transfer', selectedTransfer?.id] })
        if (selectedTransfer) {
          setSelectedTransfer((prev) => (prev ? { ...prev, status: 'requested' } : null))
        }
      } else {
        showToast({
          title: 'Failed to approve request',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const rejectHqMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectHqTransferFormValues }) =>
      rejectHqTransfer(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Request rejected', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-transfer', selectedTransfer?.id] })
        if (selectedTransfer) {
          setSelectedTransfer((prev) => (prev ? { ...prev, status: 'rejected' } : null))
        }
      } else {
        showToast({
          title: 'Failed to reject request',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const acceptMutation = useMutation({
    mutationFn: (id: string) => acceptTransfer(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Request accepted', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-transfer', selectedTransfer?.id] })
        if (selectedTransfer) {
          setSelectedTransfer((prev) => (prev ? { ...prev, status: 'draft' } : null))
        }
      } else {
        showToast({
          title: 'Failed to accept request',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectTransferFormValues }) =>
      rejectTransfer(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Request rejected', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-transfer', selectedTransfer?.id] })
        if (selectedTransfer) {
          setSelectedTransfer((prev) => (prev ? { ...prev, status: 'rejected' } : null))
        }
      } else {
        showToast({
          title: 'Failed to reject request',
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

    createTransfer: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    approveHqTransfer: approveHqMutation.mutateAsync,
    isApprovingHq: approveHqMutation.isPending,

    rejectHqTransfer: (id: string, data: RejectHqTransferFormValues) =>
      rejectHqMutation.mutateAsync({ id, data }),
    isRejectingHq: rejectHqMutation.isPending,

    approveManagerTransfer: approveManagerMutation.mutateAsync,
    isApprovingManager: approveManagerMutation.isPending,

    rejectManagerTransfer: (id: string, data: RejectManagerTransferFormValues) =>
      rejectManagerMutation.mutateAsync({ id, data }),
    isRejectingManager: rejectManagerMutation.isPending,

    acceptTransfer: acceptMutation.mutateAsync,
    isAccepting: acceptMutation.isPending,

    rejectTransfer: (id: string, data: RejectTransferFormValues) =>
      rejectMutation.mutateAsync({ id, data }),
    isRejecting: rejectMutation.isPending,

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
