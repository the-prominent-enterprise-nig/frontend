'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getQualityHolds } from '../_actions/get-quality-holds'
import { getQualityHold } from '../_actions/get-quality-hold'
import { placeOnHold } from '../_actions/place-on-hold'
import { releaseHold } from '../_actions/release-hold'
import { getItems } from '../../items/_actions/get-items'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import type {
  PlaceOnHoldFormValues,
  ReleaseHoldFormValues,
  BatchSummary,
} from '@/src/schema/inventory/quality-hold'

export function useQualityHoldManager() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [itemFilter, setItemFilter] = useState<string | undefined>(undefined)
  const [selectedBatch, setSelectedBatch] = useState<BatchSummary | null>(null)

  const queryParams = useMemo(
    () => ({ page, limit, itemId: itemFilter }),
    [page, limit, itemFilter]
  )

  const holdsQuery = useQuery({
    queryKey: ['inventory-quality-holds', queryParams],
    queryFn: () => getQualityHolds(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })

  const batchDetailQuery = useQuery({
    queryKey: ['inventory-batch', selectedBatch?.id],
    queryFn: () => getQualityHold(selectedBatch!.id),
    enabled: !!selectedBatch,
    staleTime: 30 * 1000,
  })

  const itemsQuery = useQuery({
    queryKey: ['inventory-items-lookup'],
    queryFn: () => getItems({ limit: 200, lifecycle: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  const placeOnHoldMutation = useMutation({
    mutationFn: (data: PlaceOnHoldFormValues) => placeOnHold(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Quality hold placed', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-quality-holds'] })
      } else {
        showToast({ title: 'Failed to place hold', description: result.message, status: 'error' })
      }
    },
  })

  const releaseHoldMutation = useMutation({
    mutationFn: ({ batchId, data }: { batchId: string; data: ReleaseHoldFormValues }) =>
      releaseHold(batchId, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Hold decision recorded',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['inventory-quality-holds'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-stock-balances'] })
        setSelectedBatch(null)
      } else {
        showToast({
          title: 'Failed to process decision',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const holds = holdsQuery.data?.data?.data ?? []
  const pagination = {
    total: holdsQuery.data?.data?.total ?? 0,
    page: holdsQuery.data?.data?.page ?? 1,
    limit: holdsQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((holdsQuery.data?.data?.total ?? 0) / limit),
  }

  return {
    holds,
    pagination,
    isLoading: holdsQuery.isLoading,
    isFetching: holdsQuery.isFetching,
    error: holdsQuery.error,

    itemFilter,
    setItemFilter: (v: string | undefined) => {
      setItemFilter(v)
      setPage(1)
    },

    page,
    setPage,

    selectedBatch,
    setSelectedBatch,
    batchDetail: batchDetailQuery.data?.data ?? selectedBatch,
    isLoadingDetail: batchDetailQuery.isLoading,

    itemOptions: itemsQuery.data?.data?.data ?? [],
    warehouseOptions: warehousesQuery.data?.data?.data ?? [],

    placeOnHold: (data: PlaceOnHoldFormValues) => placeOnHoldMutation.mutateAsync(data),
    isPlacingHold: placeOnHoldMutation.isPending,

    releaseHold: (batchId: string, data: ReleaseHoldFormValues) =>
      releaseHoldMutation.mutateAsync({ batchId, data }),
    isReleasingHold: releaseHoldMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-quality-holds'] }),
  }
}
