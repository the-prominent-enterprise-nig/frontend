'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getCounts } from '../_actions/get-counts'
import { getCountLines } from '../_actions/get-count-lines'
import { createCount } from '../_actions/create-count'
import { startCount } from '../_actions/start-count'
import { submitCount } from '../_actions/submit-count'
import { cancelCount } from '../_actions/cancel-count'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import type {
  CreateCountFormValues,
  SubmitCountFormValues,
  CountSummary,
  CountStatus,
} from '@/src/schema/inventory/stock-counts'
import { manilaDateOf, manilaToday } from '@/src/libs/format/manila-date'

/** Whether a count's date has come — such a count skips Scheduled and starts. */
export function isDue(scheduledDate: string | null | undefined): boolean {
  if (!scheduledDate) return true
  return manilaDateOf(scheduledDate) <= manilaToday()
}

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

  const countLinesQuery = useQuery({
    queryKey: ['inventory-stock-count-lines', selectedCount?.id],
    queryFn: () => getCountLines(selectedCount!.id),
    enabled: !!selectedCount?.id && selectedCount.status === 'in_progress',
    // Scenario 87 — the sheet autosaves as it goes, so a cached copy goes
    // stale the moment it's used. Keeping none means reopening a count
    // always loads what's on the server, never an older snapshot that a
    // Submit would then send back over the saved work.
    gcTime: 0,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateCountFormValues) => createCount(data),
    onSuccess: (result, data) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['inventory-stock-counts'] })
        // Due today: it starts straight away, and that toast says so.
        if (isDue(data.scheduledDate)) return
        showToast({
          title: 'Physical inventory created',
          description: result.message,
          status: 'success',
        })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const startMutation = useMutation({
    mutationFn: (id: string) => startCount(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Physical inventory started',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['inventory-stock-counts'] })
        // Opens the sheet too, when it was started from the list or on create.
        setSelectedCount((prev) => ({ ...prev, ...(result.data as CountSummary) }))
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
        showToast({
          title: 'Physical inventory submitted',
          description: result.message,
          status: 'success',
        })
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
        showToast({
          title: 'Physical inventory cancelled',
          description: result.message,
          status: 'success',
        })
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

    countLines: countLinesQuery.data?.data ?? [],
    isCountLinesLoading: countLinesQuery.isLoading,

    // A count due today goes straight to its sheet — no Scheduled stop.
    createCount: async (data: CreateCountFormValues) => {
      const result = await createMutation.mutateAsync(data)
      if (result.success && result.data?.id && isDue(data.scheduledDate)) {
        await startMutation.mutateAsync(result.data.id)
      }
      return result
    },
    isCreating: createMutation.isPending,

    startCount: startMutation.mutateAsync,
    isStarting: startMutation.isPending,

    submitCount: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,

    cancelCount: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-stock-counts'] }),
  }
}
