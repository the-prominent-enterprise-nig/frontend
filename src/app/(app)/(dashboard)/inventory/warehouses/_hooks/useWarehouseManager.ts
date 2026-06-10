'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getWarehouses } from '../_actions/get-warehouses'
import { createWarehouse } from '../_actions/create-warehouse'
import { updateWarehouse } from '../_actions/update-warehouse'
import { getLocations } from '../_actions/get-locations'
import { createLocation } from '../_actions/create-location'
import type {
  CreateWarehouseFormValues,
  UpdateWarehouseFormValues,
  CreateLocationFormValues,
  WarehouseSummary,
} from '@/src/schema/inventory/warehouses'

export function useWarehouseManager() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | undefined>(undefined)
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseSummary | null>(null)

  const queryParams = useMemo(
    () => ({ page, limit, search: search || undefined, status: statusFilter }),
    [page, limit, search, statusFilter]
  )

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses', queryParams],
    queryFn: () => getWarehouses(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
  })

  const locationsQuery = useQuery({
    queryKey: ['inventory-warehouse-locations', selectedWarehouse?.id],
    queryFn: () => getLocations(selectedWarehouse!.id),
    enabled: !!selectedWarehouse,
    staleTime: 2 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateWarehouseFormValues) => createWarehouse(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Warehouse created', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-warehouses'] })
      } else {
        showToast({
          title: 'Failed to create warehouse',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWarehouseFormValues }) =>
      updateWarehouse(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Warehouse updated', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-warehouses'] })
        setSelectedWarehouse((prev) => (prev ? { ...prev, ...result } : prev))
      } else {
        showToast({
          title: 'Failed to update warehouse',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const createLocationMutation = useMutation({
    mutationFn: ({ warehouseId, data }: { warehouseId: string; data: CreateLocationFormValues }) =>
      createLocation(warehouseId, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Sub-location added', description: result.message, status: 'success' })
        queryClient.invalidateQueries({
          queryKey: ['inventory-warehouse-locations', selectedWarehouse?.id],
        })
        queryClient.invalidateQueries({ queryKey: ['inventory-warehouses'] })
      } else {
        showToast({
          title: 'Failed to add sub-location',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const warehouses = warehousesQuery.data?.data?.data ?? []
  const pagination = {
    total: warehousesQuery.data?.data?.total ?? 0,
    page: warehousesQuery.data?.data?.page ?? 1,
    limit: warehousesQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((warehousesQuery.data?.data?.total ?? 0) / limit),
  }

  return {
    warehouses,
    pagination,
    isLoading: warehousesQuery.isLoading,
    isFetching: warehousesQuery.isFetching,
    error: warehousesQuery.error,

    search,
    statusFilter,
    setSearch: (val: string) => {
      setSearch(val)
      setPage(1)
    },
    setStatusFilter: (val: typeof statusFilter) => {
      setStatusFilter(val)
      setPage(1)
    },
    resetFilters: () => {
      setSearch('')
      setStatusFilter(undefined)
      setPage(1)
    },

    page,
    setPage,

    selectedWarehouse,
    setSelectedWarehouse,
    locations: locationsQuery.data?.data ?? [],
    isLoadingLocations: locationsQuery.isLoading,

    createWarehouse: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    updateWarehouse: (id: string, data: UpdateWarehouseFormValues) =>
      updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,

    addLocation: (warehouseId: string, data: CreateLocationFormValues) =>
      createLocationMutation.mutateAsync({ warehouseId, data }),
    isAddingLocation: createLocationMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-warehouses'] }),
  }
}
