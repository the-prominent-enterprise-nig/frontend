'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getWriteOffs } from '../_actions/get-write-offs'
import { getWriteOff } from '../_actions/get-write-off'
import { createWriteOff } from '../_actions/create-write-off'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getItems } from '../../items/_actions/get-items'
import type {
  CreateWriteOffFormValues,
  WriteOffReasonCode,
  WriteOffSummary,
} from '@/src/schema/inventory/write-offs'

export function useWriteOffManager() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [reasonCodeFilter, setReasonCodeFilter] = useState<WriteOffReasonCode | undefined>(
    undefined
  )
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>(undefined)
  const [fromDate, setFromDate] = useState<string | undefined>(undefined)
  const [toDate, setToDate] = useState<string | undefined>(undefined)
  const [selectedWriteOff, setSelectedWriteOff] = useState<WriteOffSummary | null>(null)

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      reasonCode: reasonCodeFilter,
      warehouseId: warehouseFilter,
      from: fromDate,
      to: toDate,
    }),
    [page, limit, reasonCodeFilter, warehouseFilter, fromDate, toDate]
  )

  const writeOffsQuery = useQuery({
    queryKey: ['inventory-write-offs', queryParams],
    queryFn: () => getWriteOffs(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })

  const writeOffDetailQuery = useQuery({
    queryKey: ['inventory-write-off', selectedWriteOff?.id],
    queryFn: () => getWriteOff(selectedWriteOff!.id),
    enabled: !!selectedWriteOff,
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
    mutationFn: (data: CreateWriteOffFormValues) => createWriteOff(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Write-off recorded',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['inventory-write-offs'] })
      } else {
        showToast({
          title: 'Failed to record write-off',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const writeOffs = writeOffsQuery.data?.data?.data ?? []
  const pagination = {
    total: writeOffsQuery.data?.data?.total ?? 0,
    page: writeOffsQuery.data?.data?.page ?? 1,
    limit: writeOffsQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((writeOffsQuery.data?.data?.total ?? 0) / limit),
  }

  const warehouseOptions = warehousesQuery.data?.data?.data ?? []
  const itemOptions = itemsLookupQuery.data?.data?.data ?? []

  return {
    writeOffs,
    pagination,
    isLoading: writeOffsQuery.isLoading,
    isFetching: writeOffsQuery.isFetching,
    error: writeOffsQuery.error,

    reasonCodeFilter,
    warehouseFilter,
    fromDate,
    toDate,
    setReasonCodeFilter: (v: WriteOffReasonCode | undefined) => {
      setReasonCodeFilter(v)
      setPage(1)
    },
    setWarehouseFilter: (v: string | undefined) => {
      setWarehouseFilter(v)
      setPage(1)
    },
    setFromDate: (v: string | undefined) => {
      setFromDate(v)
      setPage(1)
    },
    setToDate: (v: string | undefined) => {
      setToDate(v)
      setPage(1)
    },
    resetFilters: () => {
      setReasonCodeFilter(undefined)
      setWarehouseFilter(undefined)
      setFromDate(undefined)
      setToDate(undefined)
      setPage(1)
    },

    page,
    setPage,

    selectedWriteOff,
    setSelectedWriteOff,
    writeOffDetail: writeOffDetailQuery.data?.data ?? selectedWriteOff,
    isLoadingDetail: writeOffDetailQuery.isLoading,

    warehouseOptions,
    itemOptions,

    createWriteOff: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-write-offs'] }),
  }
}
