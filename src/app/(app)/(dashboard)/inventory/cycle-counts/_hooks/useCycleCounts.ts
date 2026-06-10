'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getCycleCounts } from '../_actions/get-cycle-counts'
import { scheduleCycleCount } from '../_actions/schedule-cycle-count'
import { startCount } from '../../stock-counts/_actions/start-count'
import { cancelCount } from '../../stock-counts/_actions/cancel-count'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import type { ScheduleCycleCountFormValues } from '@/src/schema/inventory/cycle-counts'
import type { CountStatus } from '@/src/schema/inventory/stock-counts'

export function useCycleCounts() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<CountStatus | undefined>(undefined)

  const queryParams = useMemo(
    () => ({ page, limit, warehouseId: warehouseFilter, status: statusFilter }),
    [page, limit, warehouseFilter, statusFilter]
  )

  const countsQuery = useQuery({
    queryKey: ['inventory-cycle-counts', queryParams],
    queryFn: () => getCycleCounts(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  })

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  const scheduleMutation = useMutation({
    mutationFn: (data: ScheduleCycleCountFormValues) => scheduleCycleCount(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Cycle count scheduled',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['inventory-cycle-counts'] })
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
        queryClient.invalidateQueries({ queryKey: ['inventory-cycle-counts'] })
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
        queryClient.invalidateQueries({ queryKey: ['inventory-cycle-counts'] })
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

  const completedCounts = counts.filter((c) => c.status === 'completed')
  const inProgressCounts = counts.filter((c) => c.status === 'in_progress')
  const completionRate =
    counts.length > 0 ? Math.round((completedCounts.length / counts.length) * 100) : 0

  return {
    counts,
    pagination,
    completedCounts,
    inProgressCounts,
    completionRate,
    isLoading: countsQuery.isLoading,
    isFetching: countsQuery.isFetching,
    error: countsQuery.error,

    warehouseFilter,
    statusFilter,
    setWarehouseFilter: (v: string | undefined) => {
      setWarehouseFilter(v)
      setPage(1)
    },
    setStatusFilter: (v: CountStatus | undefined) => {
      setStatusFilter(v)
      setPage(1)
    },
    resetFilters: () => {
      setWarehouseFilter(undefined)
      setStatusFilter(undefined)
      setPage(1)
    },

    page,
    setPage,

    warehouseOptions: warehousesQuery.data?.data?.data ?? [],

    scheduleCount: scheduleMutation.mutateAsync,
    isScheduling: scheduleMutation.isPending,

    startCount: startMutation.mutateAsync,
    isStarting: startMutation.isPending,

    cancelCount: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-cycle-counts'] }),
  }
}
