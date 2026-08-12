'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getWarehouseRequests } from '../_actions/get-warehouse-requests'
import { getWarehouseRequest } from '../_actions/get-warehouse-request'
import { createWarehouseRequest } from '../_actions/create-warehouse-request'
import {
  receiveWarehouseRequest,
  type ReceiveWarehouseRequestLine,
} from '../_actions/receive-warehouse-request'
import { cancelWarehouseRequest } from '../_actions/cancel-warehouse-request'
import { acceptWarehouseRequest } from '../_actions/accept-warehouse-request'
import { rejectWarehouseRequest } from '../_actions/reject-warehouse-request'
import { dispatchWarehouseRequest } from '../_actions/dispatch-warehouse-request'
import { getBranches } from '../_actions/get-branches'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import type {
  CreateWarehouseRequestFormValues,
  CancelWarehouseRequestFormValues,
  RejectWarehouseRequestFormValues,
  WarehouseRequestStatus,
  WarehouseRequestSummary,
} from '@/src/schema/inventory/warehouse-requests'

export function useWarehouseRequestManager() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [statusFilter, setStatusFilter] = useState<WarehouseRequestStatus | undefined>(undefined)
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [selectedRequest, setSelectedRequest] = useState<WarehouseRequestSummary | null>(null)

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      status: statusFilter,
      warehouseId: warehouseFilter,
      search: search || undefined,
    }),
    [page, limit, statusFilter, warehouseFilter, search]
  )

  const requestsQuery = useQuery({
    queryKey: ['inventory-warehouse-requests', queryParams],
    queryFn: () => getWarehouseRequests(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  })

  const requestDetailQuery = useQuery({
    queryKey: ['inventory-warehouse-request', selectedRequest?.id],
    queryFn: () => getWarehouseRequest(selectedRequest!.id),
    enabled: !!selectedRequest,
    staleTime: 15 * 1000,
  })

  // The 2 real warehouses only — the request's own destination picker.
  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-standalone-lookup'],
    queryFn: () => getWarehouses({ limit: 10, status: 'active', standaloneOnly: true }),
    staleTime: 5 * 60 * 1000,
  })

  // Every branch (with region) — used to default the warehouse picker to the
  // caller's own region, and as the explicit branch picker for Head Office.
  const branchesQuery = useQuery({
    queryKey: ['branches-lookup-with-region'],
    queryFn: () => getBranches(),
    staleTime: 5 * 60 * 1000,
  })

  // Every action mutation below must invalidate both the list AND the
  // single-record detail query — missing the detail one is exactly the bug
  // Part 4b's cancel action shipped with (list updated, open detail modal
  // stayed stuck on the old status). Centralized here so no new action can
  // repeat it.
  const invalidateRequestQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory-warehouse-requests'] })
    queryClient.invalidateQueries({
      queryKey: ['inventory-warehouse-request', selectedRequest?.id],
    })
  }

  const createMutation = useMutation({
    mutationFn: (data: CreateWarehouseRequestFormValues) => createWarehouseRequest(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Request submitted',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['inventory-warehouse-requests'] })
      } else {
        showToast({
          title: 'Failed to submit request',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const receiveMutation = useMutation({
    mutationFn: ({ id, lines }: { id: string; lines: ReceiveWarehouseRequestLine[] }) =>
      receiveWarehouseRequest(id, lines),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Request received', description: result.message, status: 'success' })
        invalidateRequestQueries()
        // Unlike every other action here, receive has two possible outcomes
        // (received vs partially_received) — use whatever the server
        // actually resolved instead of assuming one.
        if (selectedRequest && result.data?.status) {
          const status = result.data.status as WarehouseRequestStatus
          setSelectedRequest((prev) => (prev ? { ...prev, status } : null))
        }
      } else {
        showToast({
          title: 'Failed to receive request',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: CancelWarehouseRequestFormValues }) =>
      cancelWarehouseRequest(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Request cancelled', description: result.message, status: 'success' })
        invalidateRequestQueries()
        if (selectedRequest) {
          setSelectedRequest((prev) => (prev ? { ...prev, status: 'cancelled' } : null))
        }
      } else {
        showToast({
          title: 'Failed to cancel request',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const acceptMutation = useMutation({
    mutationFn: (id: string) => acceptWarehouseRequest(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Request accepted', description: result.message, status: 'success' })
        invalidateRequestQueries()
        if (selectedRequest) {
          setSelectedRequest((prev) => (prev ? { ...prev, status: 'ready' } : null))
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
    mutationFn: ({ id, data }: { id: string; data: RejectWarehouseRequestFormValues }) =>
      rejectWarehouseRequest(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Request rejected', description: result.message, status: 'success' })
        invalidateRequestQueries()
        if (selectedRequest) {
          setSelectedRequest((prev) => (prev ? { ...prev, status: 'rejected' } : null))
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
    mutationFn: (id: string) => dispatchWarehouseRequest(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Request dispatched', description: result.message, status: 'success' })
        invalidateRequestQueries()
        if (selectedRequest) {
          setSelectedRequest((prev) => (prev ? { ...prev, status: 'in_transit' } : null))
        }
      } else {
        showToast({
          title: 'Failed to dispatch request',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const requests = requestsQuery.data?.data?.data ?? []
  const pagination = {
    total: requestsQuery.data?.data?.meta?.total ?? 0,
    page: requestsQuery.data?.data?.meta?.page ?? 1,
    limit: requestsQuery.data?.data?.meta?.limit ?? limit,
    totalPages: requestsQuery.data?.data?.meta?.lastPage ?? 1,
  }

  const warehouseOptions = warehousesQuery.data?.data?.data ?? []
  const branchOptions = branchesQuery.data?.data?.data ?? []

  return {
    requests,
    pagination,
    isLoading: requestsQuery.isLoading,
    isFetching: requestsQuery.isFetching,
    error: requestsQuery.error,

    statusFilter,
    warehouseFilter,
    setStatusFilter: (v: typeof statusFilter) => {
      setStatusFilter(v)
      setPage(1)
    },
    setWarehouseFilter: (v: string | undefined) => {
      setWarehouseFilter(v)
      setPage(1)
    },
    search,
    setSearch: (v: string) => {
      setSearch(v)
      setPage(1)
    },
    resetFilters: () => {
      setStatusFilter(undefined)
      setWarehouseFilter(undefined)
      setSearch('')
      setPage(1)
    },

    page,
    setPage,

    selectedRequest,
    setSelectedRequest,
    requestDetail: requestDetailQuery.data?.data ?? selectedRequest,
    isLoadingDetail: requestDetailQuery.isLoading,

    warehouseOptions,
    branchOptions,

    createRequest: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    receiveRequest: (id: string, lines: ReceiveWarehouseRequestLine[]) =>
      receiveMutation.mutateAsync({ id, lines }),
    isReceiving: receiveMutation.isPending,

    cancelRequest: (id: string, data?: CancelWarehouseRequestFormValues) =>
      cancelMutation.mutateAsync({ id, data }),
    isCancelling: cancelMutation.isPending,

    acceptRequest: acceptMutation.mutateAsync,
    isAccepting: acceptMutation.isPending,

    rejectRequest: (id: string, data: RejectWarehouseRequestFormValues) =>
      rejectMutation.mutateAsync({ id, data }),
    isRejecting: rejectMutation.isPending,

    dispatchRequest: dispatchMutation.mutateAsync,
    isDispatching: dispatchMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-warehouse-requests'] }),
  }
}
