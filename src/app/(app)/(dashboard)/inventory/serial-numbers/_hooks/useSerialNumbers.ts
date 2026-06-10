'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getSerialNumbers } from '../_actions/get-serial-numbers'
import { registerSerialNumbers } from '../_actions/register-serial-numbers'
import { updateSerialStatus } from '../_actions/update-serial-status'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getItems } from '../../items/_actions/get-items'
import type {
  RegisterSerialsFormInput,
  UpdateSerialStatusFormValues,
  SerialStatus,
} from '@/src/schema/inventory/serial-numbers'

export function useSerialNumbers() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [statusFilter, setStatusFilter] = useState<SerialStatus | undefined>(undefined)
  const [itemFilter, setItemFilter] = useState<string | undefined>(undefined)
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState<string | undefined>(undefined)

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      status: statusFilter,
      itemId: itemFilter,
      warehouseId: warehouseFilter,
      search,
    }),
    [page, limit, statusFilter, itemFilter, warehouseFilter, search]
  )

  const serialsQuery = useQuery({
    queryKey: ['inventory-serial-numbers', queryParams],
    queryFn: () => getSerialNumbers(queryParams),
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

  const registerMutation = useMutation({
    mutationFn: (data: RegisterSerialsFormInput) => registerSerialNumbers(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Serials registered', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-serial-numbers'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSerialStatusFormValues }) =>
      updateSerialStatus(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Status updated', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-serial-numbers'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const serials = serialsQuery.data?.data?.data ?? []
  const pagination = {
    total: serialsQuery.data?.data?.total ?? 0,
    page: serialsQuery.data?.data?.page ?? 1,
    limit: serialsQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((serialsQuery.data?.data?.total ?? 0) / limit),
  }

  return {
    serials,
    pagination,
    isLoading: serialsQuery.isLoading,
    isFetching: serialsQuery.isFetching,
    error: serialsQuery.error,

    statusFilter,
    itemFilter,
    warehouseFilter,
    search,
    setStatusFilter: (v: SerialStatus | undefined) => {
      setStatusFilter(v)
      setPage(1)
    },
    setItemFilter: (v: string | undefined) => {
      setItemFilter(v)
      setPage(1)
    },
    setWarehouseFilter: (v: string | undefined) => {
      setWarehouseFilter(v)
      setPage(1)
    },
    setSearch: (v: string | undefined) => {
      setSearch(v)
      setPage(1)
    },
    resetFilters: () => {
      setStatusFilter(undefined)
      setItemFilter(undefined)
      setWarehouseFilter(undefined)
      setSearch(undefined)
      setPage(1)
    },

    page,
    setPage,

    warehouseOptions: warehousesQuery.data?.data?.data ?? [],
    itemOptions: itemsQuery.data?.data?.data ?? [],

    registerSerials: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,

    updateStatus: updateStatusMutation.mutateAsync,
    isUpdatingStatus: updateStatusMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-serial-numbers'] }),
  }
}
