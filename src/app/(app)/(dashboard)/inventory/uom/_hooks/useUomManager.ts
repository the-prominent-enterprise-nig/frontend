'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getUoms } from '../_actions/get-uoms'
import { createUom } from '../_actions/create-uom'
import { updateUom } from '../_actions/update-uom'
import type {
  CreateUomFormValues,
  UpdateUomFormValues,
  UomRecord,
} from '@/src/schema/inventory/uom'

export function useUomManager() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [search, setSearch] = useState('')
  const [editTarget, setEditTarget] = useState<UomRecord | null>(null)

  const queryParams = useMemo(
    () => ({ page, limit, search: search || undefined }),
    [page, limit, search]
  )

  const uomsQuery = useQuery({
    queryKey: ['inventory-uom-management', queryParams],
    queryFn: () => getUoms(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
  })

  // Fetch only base units for the "base unit" selector in create/edit forms
  const baseUnitsQuery = useQuery({
    queryKey: ['inventory-uom-base-units'],
    queryFn: () => getUoms({ limit: 200, isBaseUnit: true }),
    staleTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateUomFormValues) => createUom(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Unit created', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-uom-management'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-uom-base-units'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-uom'] })
      } else {
        showToast({ title: 'Failed to create unit', description: result.message, status: 'error' })
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUomFormValues }) => updateUom(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Unit updated', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-uom-management'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-uom-base-units'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-uom'] })
        setEditTarget(null)
      } else {
        showToast({ title: 'Failed to update unit', description: result.message, status: 'error' })
      }
    },
  })

  const uoms = uomsQuery.data?.data?.data ?? []
  const pagination = {
    total: uomsQuery.data?.data?.total ?? 0,
    page: uomsQuery.data?.data?.page ?? 1,
    limit: uomsQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((uomsQuery.data?.data?.total ?? 0) / limit),
  }

  const baseUnits = baseUnitsQuery.data?.data?.data ?? []

  return {
    uoms,
    pagination,
    isLoading: uomsQuery.isLoading,
    isFetching: uomsQuery.isFetching,
    error: uomsQuery.error,

    search,
    setSearch: (v: string) => {
      setSearch(v)
      setPage(1)
    },
    page,
    setPage,

    baseUnits,

    editTarget,
    setEditTarget,

    createUom: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    updateUom: (id: string, data: UpdateUomFormValues) => updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-uom-management'] }),
  }
}
