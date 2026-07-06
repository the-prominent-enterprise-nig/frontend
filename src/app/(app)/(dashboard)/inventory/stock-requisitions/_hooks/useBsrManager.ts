'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getBsrs } from '../_actions/get-bsrs'
import { getBsr } from '../_actions/get-bsr'
import { createBsr } from '../_actions/create-bsr'
import { submitBsr } from '../_actions/submit-bsr'
import { approveBsr } from '../_actions/approve-bsr'
import { rejectBsr } from '../_actions/reject-bsr'
import { cancelBsr } from '../_actions/cancel-bsr'
import { fulfillBsr } from '../_actions/fulfill-bsr'
import { getBranches } from '../_actions/get-branches'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getItems } from '../../items/_actions/get-items'
import type {
  BsrStatus,
  BsrSummary,
  CreateBsrFormValues,
  ApproveBsrFormValues,
  RejectBsrFormValues,
} from '@/src/schema/inventory/stock-requisitions'

export function useBsrManager() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [statusFilter, setStatusFilter] = useState<BsrStatus | undefined>(undefined)
  const [branchFilter, setBranchFilter] = useState<string | undefined>(undefined)
  const [selectedBsr, setSelectedBsr] = useState<BsrSummary | null>(null)

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      status: statusFilter,
      branchId: branchFilter,
    }),
    [page, limit, statusFilter, branchFilter]
  )

  const bsrsQuery = useQuery({
    queryKey: ['inventory-bsrs', queryParams],
    queryFn: () => getBsrs(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })

  const bsrDetailQuery = useQuery({
    queryKey: ['inventory-bsr', selectedBsr?.id],
    queryFn: () => getBsr(selectedBsr!.id),
    enabled: !!selectedBsr,
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

  const branchesQuery = useQuery({
    queryKey: ['branches-lookup'],
    queryFn: () => getBranches(),
    staleTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateBsrFormValues) => createBsr(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Requisition created',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['inventory-bsrs'] })
      } else {
        showToast({
          title: 'Failed to create requisition',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const submitMutation = useMutation({
    mutationFn: (id: string) => submitBsr(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Requisition submitted', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-bsrs'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-bsr', selectedBsr?.id] })
        if (selectedBsr) {
          setSelectedBsr((prev) => (prev ? { ...prev, status: 'submitted' } : null))
        }
      } else {
        showToast({
          title: 'Failed to submit requisition',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: ApproveBsrFormValues }) =>
      approveBsr(id, data?.reservationDays),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Requisition approved', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-bsrs'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-bsr', selectedBsr?.id] })
        if (selectedBsr) {
          setSelectedBsr((prev) => (prev ? { ...prev, status: 'approved' } : null))
        }
      } else {
        showToast({
          title: 'Failed to approve requisition',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectBsrFormValues }) =>
      rejectBsr(id, data.reason),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Requisition rejected', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-bsrs'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-bsr', selectedBsr?.id] })
        if (selectedBsr) {
          setSelectedBsr((prev) => (prev ? { ...prev, status: 'rejected' } : null))
        }
      } else {
        showToast({
          title: 'Failed to reject requisition',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelBsr(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Requisition cancelled', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-bsrs'] })
        setSelectedBsr(null)
      } else {
        showToast({
          title: 'Failed to cancel requisition',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const fulfillMutation = useMutation({
    mutationFn: (id: string) => fulfillBsr(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Requisition fulfilled', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-bsrs'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-bsr', selectedBsr?.id] })
        if (selectedBsr) {
          setSelectedBsr((prev) => (prev ? { ...prev, status: 'fulfilled' } : null))
        }
      } else {
        showToast({
          title: 'Failed to fulfill requisition',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const rawData = bsrsQuery.data?.data as
    | { data: BsrSummary[]; meta: { total: number; page: number; limit: number; lastPage: number } }
    | undefined

  const bsrs = rawData?.data ?? []
  const pagination = {
    total: rawData?.meta?.total ?? 0,
    page: rawData?.meta?.page ?? 1,
    limit: rawData?.meta?.limit ?? limit,
    totalPages: rawData?.meta?.lastPage ?? 1,
  }

  const warehouseOptions = warehousesQuery.data?.data?.data ?? []
  const itemOptions = itemsLookupQuery.data?.data?.data ?? []
  const branchOptions = (branchesQuery.data?.data?.data as { id: string; name: string }[]) ?? []

  return {
    bsrs,
    pagination,
    isLoading: bsrsQuery.isLoading,
    isFetching: bsrsQuery.isFetching,
    error: bsrsQuery.error,

    statusFilter,
    branchFilter,
    setStatusFilter: (v: typeof statusFilter) => {
      setStatusFilter(v)
      setPage(1)
    },
    setBranchFilter: (v: string | undefined) => {
      setBranchFilter(v)
      setPage(1)
    },
    resetFilters: () => {
      setStatusFilter(undefined)
      setBranchFilter(undefined)
      setPage(1)
    },

    page,
    setPage,

    selectedBsr,
    setSelectedBsr,
    bsrDetail: (bsrDetailQuery.data?.data as BsrSummary | undefined) ?? selectedBsr,
    isLoadingDetail: bsrDetailQuery.isLoading,

    warehouseOptions,
    itemOptions,
    branchOptions,

    createBsr: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    submitBsr: (id: string) => submitMutation.mutateAsync(id),
    isSubmitting: submitMutation.isPending,

    approveBsr: (id: string, data?: ApproveBsrFormValues) =>
      approveMutation.mutateAsync({ id, data }),
    isApproving: approveMutation.isPending,

    rejectBsr: (id: string, data: RejectBsrFormValues) => rejectMutation.mutateAsync({ id, data }),
    isRejecting: rejectMutation.isPending,

    cancelBsr: (id: string) => cancelMutation.mutateAsync(id),
    isCancelling: cancelMutation.isPending,

    fulfillBsr: (id: string) => fulfillMutation.mutateAsync(id),
    isFulfilling: fulfillMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-bsrs'] }),
  }
}
