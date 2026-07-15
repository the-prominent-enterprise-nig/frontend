'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { STALE } from '@/src/libs/query/stale-times'
import { getItems } from '../_actions/get-items'
import { createItem } from '../_actions/create-item'
import { updateItem, updateItemLifecycle } from '../_actions/update-item'
import { updateItemAttributes } from '../_actions/update-item-attributes'
import { deleteItem } from '../_actions/delete-item'
import {
  getUnitsOfMeasure,
  getItemGroups,
  getItemSubgroups,
  getItemBrands,
  getItemTypes,
} from '../_actions/get-lookup-data'
import { getCategoriesFlat } from '../../categories/_actions/get-categories-flat'
import { createBundle } from '../../bundles/_actions/create-bundle'
import { getBundleComponents } from '../../bundles/_actions/get-bundle-components'
import { getVariants } from '../_actions/get-variants'
import { createVariant } from '../_actions/create-variant'
import type {
  CreateItemFormValues,
  UpdateItemFormValues,
  UomOption,
  ItemSummary,
  ItemGroupOption,
  ItemSubgroupOption,
  ClassificationOption,
} from '@/src/schema/inventory/items'
import type { FlatCategory } from '@/src/schema/inventory/categories'
import type { CreateBundleFormValues } from '@/src/schema/inventory/bundles'
import type { CreateVariantFormValues } from '@/src/schema/inventory/variants'

type CategorySelectOption = { id: string; name: string; depth: number }

function flatToSelectOptions(flat: FlatCategory[]): CategorySelectOption[] {
  const map = new Map<string, FlatCategory & { children: FlatCategory[] }>()
  const roots: (FlatCategory & { children: FlatCategory[] })[] = []

  for (const c of flat) map.set(c.id, { ...c, children: [] })

  for (const node of map.values()) {
    const parent = node.parentCategoryId ? map.get(node.parentCategoryId) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  function sort(nodes: (FlatCategory & { children: FlatCategory[] })[]) {
    nodes.sort(
      (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name)
    )
  }

  const result: CategorySelectOption[] = []
  function traverse(nodes: (FlatCategory & { children: FlatCategory[] })[], depth: number) {
    sort(nodes)
    for (const n of nodes) {
      result.push({ id: n.id, name: n.name, depth })
      if (n.children.length)
        traverse(n.children as (FlatCategory & { children: FlatCategory[] })[], depth + 1)
    }
  }
  traverse(roots, 0)
  return result
}

export function useItemMaster() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [search, setSearch] = useState('')
  const [lifecycle, setLifecycle] = useState<'active' | 'discontinued' | 'archived' | undefined>(
    undefined
  )
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string | undefined>(undefined)
  const [sortBy, setSortBy] = useState<'name' | 'sku' | 'createdAt' | 'costPrice' | 'sellingPrice'>(
    'createdAt'
  )
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedBundleItem, setSelectedBundleItem] = useState<ItemSummary | null>(null)
  const [selectedVariantItem, setSelectedVariantItem] = useState<ItemSummary | null>(null)

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      search: search || undefined,
      lifecycle,
      primaryCategoryId,
      sortBy,
      sortOrder,
    }),
    [page, limit, search, lifecycle, primaryCategoryId, sortBy, sortOrder]
  )

  const itemsQuery = useQuery({
    queryKey: ['inventory-items', queryParams],
    queryFn: () => getItems(queryParams),
    placeholderData: keepPreviousData,
    staleTime: STALE.OPERATIONAL,
  })

  const categoriesQuery = useQuery({
    queryKey: ['inventory-categories-flat'],
    queryFn: () => getCategoriesFlat({ limit: 500 }),
    staleTime: 10 * 60 * 1000,
  })

  const uomQuery = useQuery({
    queryKey: ['inventory-uom'],
    queryFn: () => getUnitsOfMeasure(),
    staleTime: 10 * 60 * 1000,
  })

  const itemGroupsQuery = useQuery({
    queryKey: ['inventory-item-groups'],
    queryFn: () => getItemGroups(),
    staleTime: 10 * 60 * 1000,
  })

  const itemSubgroupsQuery = useQuery({
    queryKey: ['inventory-item-subgroups'],
    queryFn: () => getItemSubgroups(),
    staleTime: 10 * 60 * 1000,
  })

  const itemBrandsQuery = useQuery({
    queryKey: ['inventory-item-brands'],
    queryFn: () => getItemBrands(),
    staleTime: 10 * 60 * 1000,
  })

  const itemTypesQuery = useQuery({
    queryKey: ['inventory-item-types'],
    queryFn: () => getItemTypes(),
    staleTime: 10 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateItemFormValues) => createItem(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Item created', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      } else {
        showToast({ title: 'Failed to create item', description: result.message, status: 'error' })
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateItemFormValues }) => updateItem(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Item updated', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      } else {
        showToast({ title: 'Failed to update item', description: result.message, status: 'error' })
      }
    },
  })

  const lifecycleMutation = useMutation({
    mutationFn: ({
      id,
      lifecycle: lc,
    }: {
      id: string
      lifecycle: 'active' | 'discontinued' | 'archived'
    }) => updateItemLifecycle(id, lc),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Status updated', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      } else {
        showToast({
          title: 'Failed to update status',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const bundleComponentsQuery = useQuery({
    queryKey: ['inventory-bundle-components', selectedBundleItem?.id],
    queryFn: () => getBundleComponents(selectedBundleItem!.id),
    enabled: !!selectedBundleItem,
    staleTime: 30 * 1000,
  })

  const variantsQuery = useQuery({
    queryKey: ['inventory-item-variants', selectedVariantItem?.id],
    queryFn: () => getVariants(selectedVariantItem!.id),
    enabled: !!selectedVariantItem,
    staleTime: 30 * 1000,
  })

  const createVariantMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: CreateVariantFormValues }) =>
      createVariant(itemId, data),
    onSuccess: (result, { itemId }) => {
      if (result.success) {
        showToast({ title: 'Variant created', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-item-variants', itemId] })
        queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      } else {
        showToast({
          title: 'Failed to create variant',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const itemsLookupQuery = useQuery({
    queryKey: ['inventory-items-lookup'],
    queryFn: () => getItems({ limit: 200, lifecycle: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  const createBundleMutation = useMutation({
    mutationFn: (data: CreateBundleFormValues) => createBundle(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Bundle created', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
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

  const updateAttributesMutation = useMutation({
    mutationFn: ({ id, attributes }: { id: string; attributes: Record<string, string> }) =>
      updateItemAttributes(id, attributes),
    onSuccess: (result) => {
      if (!result.success) {
        showToast({
          title: 'Failed to update attributes',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteItem(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Item deleted', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      } else {
        showToast({ title: 'Failed to delete item', description: result.message, status: 'error' })
      }
    },
  })

  const items = itemsQuery.data?.data?.data ?? []
  const pagination = {
    total: itemsQuery.data?.data?.total ?? 0,
    page: itemsQuery.data?.data?.page ?? 1,
    limit: itemsQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((itemsQuery.data?.data?.total ?? 0) / limit),
  }

  function resetFilters() {
    setSearch('')
    setLifecycle(undefined)
    setPrimaryCategoryId(undefined)
    setSortBy('createdAt')
    setSortOrder('desc')
    setPage(1)
  }

  return {
    // Data
    items,
    pagination,
    categories: flatToSelectOptions(categoriesQuery.data?.data?.data ?? []),
    uomOptions: (() => {
      const d = uomQuery.data?.data
      if (!d) return []
      if (Array.isArray(d)) return d
      if (Array.isArray((d as { data?: unknown }).data)) return (d as { data: UomOption[] }).data
      return []
    })(),
    groupOptions: (itemGroupsQuery.data?.data ?? []) as ItemGroupOption[],
    subgroupOptions: (itemSubgroupsQuery.data?.data ?? []) as ItemSubgroupOption[],
    brandOptions: (itemBrandsQuery.data?.data ?? []) as ClassificationOption[],
    typeOptions: (itemTypesQuery.data?.data ?? []) as ClassificationOption[],

    // Loading / Error
    isLoading: itemsQuery.isLoading,
    isFetching: itemsQuery.isFetching,
    error: itemsQuery.error,

    // Filters
    search,
    lifecycle,
    primaryCategoryId,
    setSearch: (val: string) => {
      setSearch(val)
      setPage(1)
    },
    setLifecycle: (val: typeof lifecycle) => {
      setLifecycle(val)
      setPage(1)
    },
    setPrimaryCategoryId: (val: string | undefined) => {
      setPrimaryCategoryId(val)
      setPage(1)
    },
    sortBy,
    sortOrder,
    setSortBy: (val: typeof sortBy) => {
      setSortBy(val)
      setPage(1)
    },
    setSortOrder: (val: typeof sortOrder) => {
      setSortOrder(val)
      setPage(1)
    },
    resetFilters,

    // Pagination
    page,
    setPage,

    // Mutations
    createItem: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    updateItem: (id: string, data: UpdateItemFormValues) =>
      updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,

    updateItemAttributes: (id: string, attributes: Record<string, string>) =>
      updateAttributesMutation.mutateAsync({ id, attributes }),
    isUpdatingAttributes: updateAttributesMutation.isPending,

    updateLifecycle: (id: string, lc: 'active' | 'discontinued' | 'archived') =>
      lifecycleMutation.mutateAsync({ id, lifecycle: lc }),

    deleteItem: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-items'] }),

    // Bundle
    selectedBundleItem,
    setSelectedBundleItem,
    bundleComponents: bundleComponentsQuery.data?.data?.components ?? [],
    bundleAvailableQty: bundleComponentsQuery.data?.data?.bundleAvailableQty ?? null,
    isLoadingComponents: bundleComponentsQuery.isLoading,
    itemOptions: (itemsLookupQuery.data?.data?.data ?? []).filter((i) => !i.isBundle),
    createBundle: createBundleMutation.mutateAsync,
    isCreatingBundle: createBundleMutation.isPending,

    // Variants
    selectedVariantItem,
    setSelectedVariantItem,
    variants: variantsQuery.data?.data?.data ?? [],
    isLoadingVariants: variantsQuery.isLoading,
    createVariant: (itemId: string, data: CreateVariantFormValues) =>
      createVariantMutation.mutateAsync({ itemId, data }),
    isCreatingVariant: createVariantMutation.isPending,
  }
}
