'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getBundleItems } from '../_actions/get-bundle-items'
import { getBundleComponents } from '../_actions/get-bundle-components'
import { createBundle } from '../_actions/create-bundle'
import { getItems } from '../../items/_actions/get-items'
import { getCategories, getUnitsOfMeasure } from '../../items/_actions/get-lookup-data'
import type { CreateBundleFormValues } from '@/src/schema/inventory/bundles'
import type { ItemSummary } from '@/src/schema/inventory/items'

export function useBundleManager() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [search, setSearch] = useState<string | undefined>(undefined)
  const [selectedBundle, setSelectedBundle] = useState<ItemSummary | null>(null)

  const queryParams = useMemo(() => ({ page, limit, search }), [page, limit, search])

  const bundlesQuery = useQuery({
    queryKey: ['inventory-bundles', queryParams],
    queryFn: () => getBundleItems(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })

  const bundleComponentsQuery = useQuery({
    queryKey: ['inventory-bundle-components', selectedBundle?.id],
    queryFn: () => getBundleComponents(selectedBundle!.id),
    enabled: !!selectedBundle,
    staleTime: 30 * 1000,
  })

  const itemsLookupQuery = useQuery({
    queryKey: ['inventory-items-lookup'],
    queryFn: () => getItems({ limit: 200, lifecycle: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  const categoriesQuery = useQuery({
    queryKey: ['inventory-categories-lookup'],
    queryFn: () => getCategories({ status: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  const uomQuery = useQuery({
    queryKey: ['inventory-uom-lookup'],
    queryFn: () => getUnitsOfMeasure(),
    staleTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateBundleFormValues) => createBundle(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Bundle created', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-bundles'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-items-lookup'] })
      } else {
        showToast({
          title: 'Failed to create bundle',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const bundleApiError =
    bundlesQuery.data && bundlesQuery.data.success === false
      ? (bundlesQuery.data.error ?? 'Failed to load bundles')
      : undefined

  const bundles = bundlesQuery.data?.data?.data ?? []
  const pagination = {
    total: bundlesQuery.data?.data?.total ?? 0,
    page: bundlesQuery.data?.data?.page ?? 1,
    limit: bundlesQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((bundlesQuery.data?.data?.total ?? 0) / limit),
  }

  const itemOptions = (itemsLookupQuery.data?.data?.data ?? []).filter((item) => !item.isBundle)
  const categoryOptions = categoriesQuery.data?.data?.data ?? []
  const uomOptions = uomQuery.data?.data?.data ?? []

  const bundleComponents = bundleComponentsQuery.data?.data?.components ?? []
  const bundleAvailableQty = bundleComponentsQuery.data?.data?.bundleAvailableQty ?? null

  return {
    bundles,
    pagination,
    isLoading: bundlesQuery.isLoading,
    isFetching: bundlesQuery.isFetching,
    error: bundlesQuery.error ?? (bundleApiError ? new Error(bundleApiError) : null),

    search,
    setSearch: (v: string | undefined) => {
      setSearch(v)
      setPage(1)
    },

    page,
    setPage,

    selectedBundle,
    setSelectedBundle,
    bundleComponents,
    bundleAvailableQty,
    isLoadingComponents: bundleComponentsQuery.isLoading,

    itemOptions,
    categoryOptions,
    uomOptions,

    createBundle: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-bundles'] }),
  }
}
