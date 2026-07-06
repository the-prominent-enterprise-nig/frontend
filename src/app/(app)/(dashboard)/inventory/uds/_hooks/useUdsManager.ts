'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { STALE } from '@/src/libs/query/stale-times'
import { getUdsList } from '../_actions/get-uds-list'
import { createUds } from '../_actions/create-uds'
import { updateUdsStatus } from '../_actions/update-uds-status'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getSerialNumbers } from '../../serial-numbers/_actions/get-serial-numbers'
import type {
  CreateUdsFormValues,
  UpdateUdsStatusFormValues,
  UdsStatus,
} from '@/src/schema/inventory/uds'

export function useUdsManager() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [statusFilter, setStatusFilter] = useState<UdsStatus | undefined>(undefined)
  const [reasonFilter, setReasonFilter] = useState<string | undefined>(undefined)
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>(undefined)

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      status: statusFilter,
      reason: reasonFilter,
      warehouseId: warehouseFilter,
    }),
    [page, limit, statusFilter, reasonFilter, warehouseFilter]
  )

  const udsQuery = useQuery({
    queryKey: ['inventory-uds', queryParams],
    queryFn: () => getUdsList(queryParams),
    placeholderData: keepPreviousData,
    staleTime: STALE.REALTIME,
  })

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active' }),
    staleTime: STALE.LOOKUP,
  })

  const serialsQuery = useQuery({
    queryKey: ['inventory-serials-in-stock'],
    queryFn: () => getSerialNumbers({ status: 'in_stock', limit: 500 }),
    staleTime: STALE.LOOKUP,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateUdsFormValues) => createUds(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'UDS issued', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-uds'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-serials-in-stock'] })
      } else {
        showToast({ title: 'Failed to issue UDS', description: result.message, status: 'error' })
      }
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUdsStatusFormValues }) =>
      updateUdsStatus(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Status updated', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-uds'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-serials-in-stock'] })
      } else {
        showToast({
          title: 'Failed to update status',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const records = udsQuery.data?.data?.data ?? []
  const pagination = {
    total: udsQuery.data?.data?.meta.total ?? 0,
    page: udsQuery.data?.data?.meta.page ?? 1,
    limit: udsQuery.data?.data?.meta.limit ?? limit,
    lastPage: udsQuery.data?.data?.meta.lastPage ?? 1,
  }

  return {
    records,
    pagination,
    isLoading: udsQuery.isLoading,
    isFetching: udsQuery.isFetching,
    error: udsQuery.error,

    statusFilter,
    reasonFilter,
    warehouseFilter,
    setStatusFilter: (v: UdsStatus | undefined) => {
      setStatusFilter(v)
      setPage(1)
    },
    setReasonFilter: (v: string | undefined) => {
      setReasonFilter(v)
      setPage(1)
    },
    setWarehouseFilter: (v: string | undefined) => {
      setWarehouseFilter(v)
      setPage(1)
    },
    resetFilters: () => {
      setStatusFilter(undefined)
      setReasonFilter(undefined)
      setWarehouseFilter(undefined)
      setPage(1)
    },

    page,
    setPage,

    warehouseOptions: warehousesQuery.data?.data?.data ?? [],
    serialOptions: serialsQuery.data?.data?.data ?? [],

    createUds: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    updateStatus: (id: string, data: UpdateUdsStatusFormValues) =>
      updateStatusMutation.mutateAsync({ id, data }),
    isUpdatingStatus: updateStatusMutation.isPending,
  }
}
