'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getCounts } from '../_actions/get-counts'
import { createCount } from '../_actions/create-count'
import { startCount } from '../_actions/start-count'
import { submitCount } from '../_actions/submit-count'
import { cancelCount } from '../_actions/cancel-count'
import { createAdjustment } from '../_actions/create-adjustment'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getItems } from '../../items/_actions/get-items'
import type {
  CreateCountFormValues,
  SubmitCountFormValues,
  CreateAdjustmentFormValues,
  CountSummary,
  CountStatus,
} from '@/src/schema/inventory/stock-counts'

export function useStockCounts() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>(undefined)
  const [countTypeFilter, setCountTypeFilter] = useState<string | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<CountStatus | undefined>(undefined)
  const [selectedCount, setSelectedCount] = useState<CountSummary | null>(null)

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      warehouseId: warehouseFilter,
      countType: countTypeFilter,
      status: statusFilter,
    }),
    [page, limit, warehouseFilter, countTypeFilter, statusFilter]
  )

  const countsQuery = useQuery({
    queryKey: ['inventory-stock-counts', queryParams],
    queryFn: () => getCounts(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  })

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  const itemsQuery = useQuery({
    queryKey: ['inventory-items-lookup'],
    queryFn: () => getItems({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateCountFormValues) => createCount(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Count session created',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['inventory-stock-counts'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const startMutation = useMutation({
    mutationFn: (id: string) => startCount(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Count started', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-stock-counts'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const submitMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SubmitCountFormValues }) =>
      submitCount(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Count submitted', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-stock-counts'] })
        setSelectedCount(null)
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelCount(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Count cancelled', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-stock-counts'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const adjustMutation = useMutation({
    mutationFn: (data: CreateAdjustmentFormValues) => createAdjustment(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Adjustment recorded', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-stock-counts'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const counts = countsQuery.data?.data?.data ?? []
  const pagination = {
    total: countsQuery.data?.data?.total ?? 0,
    page: countsQuery.data?.data?.page ?? 1,
    limit: countsQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((countsQuery.data?.data?.total ?? 0) / limit),
  }

  return {
    counts,
    pagination,
    isLoading: countsQuery.isLoading,
    isFetching: countsQuery.isFetching,
    error: countsQuery.error,

    warehouseFilter,
    countTypeFilter,
    statusFilter,
    setWarehouseFilter: (v: string | undefined) => {
      setWarehouseFilter(v)
      setPage(1)
    },
    setCountTypeFilter: (v: string | undefined) => {
      setCountTypeFilter(v)
      setPage(1)
    },
    setStatusFilter: (v: CountStatus | undefined) => {
      setStatusFilter(v)
      setPage(1)
    },
    resetFilters: () => {
      setWarehouseFilter(undefined)
      setCountTypeFilter(undefined)
      setStatusFilter(undefined)
      setPage(1)
    },

    page,
    setPage,

    selectedCount,
    setSelectedCount,

    warehouseOptions: warehousesQuery.data?.data?.data ?? [],
    itemOptions: itemsQuery.data?.data?.data ?? [],

    createCount: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    startCount: startMutation.mutateAsync,
    isStarting: startMutation.isPending,

    submitCount: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,

    cancelCount: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,

    createAdjustment: adjustMutation.mutateAsync,
    isAdjusting: adjustMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-stock-counts'] }),
  }
}
