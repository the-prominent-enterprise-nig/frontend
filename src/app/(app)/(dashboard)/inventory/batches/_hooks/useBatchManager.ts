'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getBatches, getExpiringBatches } from '../_actions/get-batches'
import { createBatch } from '../_actions/create-batch'
import {
  updateBatchStatus,
  placeBatchHold,
  releaseBatchHold,
} from '../_actions/update-batch-status'
import { getItems } from '../../items/_actions/get-items'
import type {
  CreateBatchFormValues,
  UpdateBatchStatusFormValues,
  BatchSummary,
  BatchStatus,
} from '@/src/schema/inventory/batches'

export function useBatchManager() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [statusFilter, setStatusFilter] = useState<BatchStatus | undefined>(undefined)
  const [itemFilter, setItemFilter] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState<string | undefined>(undefined)
  const [selectedBatch, setSelectedBatch] = useState<BatchSummary | null>(null)

  const queryParams = useMemo(
    () => ({ page, limit, status: statusFilter, itemId: itemFilter, search }),
    [page, limit, statusFilter, itemFilter, search]
  )

  const batchesQuery = useQuery({
    queryKey: ['inventory-batches', queryParams],
    queryFn: () => getBatches(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  })

  const expiringQuery = useQuery({
    queryKey: ['inventory-batches-expiring'],
    queryFn: () => getExpiringBatches({ days: 30, limit: 50 }),
    staleTime: 5 * 60 * 1000,
  })

  const itemsQuery = useQuery({
    queryKey: ['inventory-items-lookup'],
    queryFn: () => getItems({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateBatchFormValues) => createBatch(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Batch created', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-batches'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBatchStatusFormValues }) =>
      updateBatchStatus(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Status updated', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-batches'] })
        setSelectedBatch(null)
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const holdMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => placeBatchHold(id, reason),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Hold placed', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-batches'] })
        setSelectedBatch(null)
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const releaseMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => releaseBatchHold(id, reason),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Hold released', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-batches'] })
        setSelectedBatch(null)
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const batches = batchesQuery.data?.data?.data ?? []
  const expiringBatches = expiringQuery.data?.data?.data ?? []
  const pagination = {
    total: batchesQuery.data?.data?.total ?? 0,
    page: batchesQuery.data?.data?.page ?? 1,
    limit: batchesQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((batchesQuery.data?.data?.total ?? 0) / limit),
  }

  return {
    batches,
    expiringBatches,
    pagination,
    isLoading: batchesQuery.isLoading,
    isFetching: batchesQuery.isFetching,
    error: batchesQuery.error,

    statusFilter,
    itemFilter,
    search,
    setStatusFilter: (v: BatchStatus | undefined) => {
      setStatusFilter(v)
      setPage(1)
    },
    setItemFilter: (v: string | undefined) => {
      setItemFilter(v)
      setPage(1)
    },
    setSearch: (v: string | undefined) => {
      setSearch(v)
      setPage(1)
    },
    resetFilters: () => {
      setStatusFilter(undefined)
      setItemFilter(undefined)
      setSearch(undefined)
      setPage(1)
    },

    page,
    setPage,

    selectedBatch,
    setSelectedBatch,

    itemOptions: itemsQuery.data?.data?.data ?? [],

    createBatch: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    updateStatus: updateStatusMutation.mutateAsync,
    isUpdatingStatus: updateStatusMutation.isPending,

    placeHold: holdMutation.mutateAsync,
    isPlacingHold: holdMutation.isPending,

    releaseHold: releaseMutation.mutateAsync,
    isReleasingHold: releaseMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-batches'] }),
  }
}
