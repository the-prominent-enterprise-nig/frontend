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
import { submitItem } from '../_actions/submit-item'
import { confirmItemAccounting } from '../_actions/confirm-item-accounting'
import { rejectItemAccounting } from '../_actions/reject-item-accounting'
import { approveItem } from '../_actions/approve-item'
import { rejectItem } from '../_actions/reject-item'
import { getUnitsOfMeasure, getItemBrands, getItemTypes } from '../_actions/get-lookup-data'
import { getCategoriesFlat } from '../../categories/_actions/get-categories-flat'
import { createBundle } from '../../bundles/_actions/create-bundle'
import { getBundleComponents } from '../../bundles/_actions/get-bundle-components'
import { addBundleComponent } from '../../bundles/_actions/add-bundle-component'
import { removeBundleComponent } from '../../bundles/_actions/remove-bundle-component'
import { flatToCategorySelectOptions } from '@/src/libs/format/category-tree'
import type {
  CreateItemFormValues,
  UpdateItemFormValues,
  UomOption,
  ItemSummary,
  ClassificationOption,
  ItemApprovalStatus,
  ConfirmAccountingFormValues,
  RejectAccountingFormValues,
  ApproveItemFormValues,
  RejectItemFormValues,
} from '@/src/schema/inventory/items'
import type {
  CreateBundleFormValues,
  BundleComponentFormValues,
} from '@/src/schema/inventory/bundles'

export function useItemMaster() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [search, setSearch] = useState('')
  const [lifecycle, setLifecycle] = useState<'active' | 'discontinued' | 'archived' | undefined>(
    undefined
  )
  const [approvalStatus, setApprovalStatus] = useState<ItemApprovalStatus | undefined>(undefined)
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string | undefined>(undefined)
  const [sortBy, setSortBy] = useState<'name' | 'sku' | 'createdAt' | 'costPrice' | 'sellingPrice'>(
    'createdAt'
  )
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedBundleItem, setSelectedBundleItem] = useState<ItemSummary | null>(null)
  const [removingComponentId, setRemovingComponentId] = useState<string | null>(null)

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      search: search || undefined,
      // SKU is intentionally not shown or searchable in the Item Master
      // catalog list — see ItemMasterTable's item row and this page's search
      // placeholder, which no longer mention SKU either.
      matchSku: false,
      lifecycle,
      approvalStatus,
      primaryCategoryId,
      sortBy,
      sortOrder,
    }),
    [page, limit, search, lifecycle, approvalStatus, primaryCategoryId, sortBy, sortOrder]
  )

  const itemsQuery = useQuery({
    queryKey: ['inventory-items', queryParams],
    queryFn: () => getItems(queryParams),
    placeholderData: keepPreviousData,
    staleTime: STALE.OPERATIONAL,
    // Scenario 26 — same gap found live in the credit applications queue
    // (see useCreditApplications.ts): this is a three-way maker-checker
    // handoff across three different people's browser tabs (Stock
    // Controller submits, Branch Manager confirms accounting, Master Data
    // Approver decides), and it's exactly where an item-master notification's
    // click-through lands — staleTime alone only refetches on THIS tab's
    // own refocus/remount, so another actor's transition could sit stale
    // here indefinitely.
    refetchInterval: 10 * 1000,
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

  // Scenario 16 — Item Master Governance
  const submitMutation = useMutation({
    mutationFn: (id: string) => submitItem(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Item submitted', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      } else {
        showToast({ title: 'Failed to submit item', description: result.message, status: 'error' })
      }
    },
  })

  const confirmAccountingMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ConfirmAccountingFormValues }) =>
      confirmItemAccounting(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Accounting confirmed', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      } else {
        showToast({
          title: 'Failed to confirm accounting',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const rejectAccountingMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectAccountingFormValues }) =>
      rejectItemAccounting(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Item rejected', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      } else {
        showToast({ title: 'Failed to reject item', description: result.message, status: 'error' })
      }
    },
  })

  const approveItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApproveItemFormValues }) =>
      approveItem(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Item approved', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      } else {
        showToast({ title: 'Failed to approve item', description: result.message, status: 'error' })
      }
    },
  })

  const rejectItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectItemFormValues }) => rejectItem(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Item rejected', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      } else {
        showToast({ title: 'Failed to reject item', description: result.message, status: 'error' })
      }
    },
  })

  const bundleComponentsQuery = useQuery({
    queryKey: ['inventory-bundle-components', selectedBundleItem?.id],
    queryFn: () => getBundleComponents(selectedBundleItem!.id),
    enabled: !!selectedBundleItem,
    staleTime: 30 * 1000,
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

  const addBundleComponentMutation = useMutation({
    mutationFn: (data: BundleComponentFormValues) =>
      addBundleComponent(selectedBundleItem!.id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Component added', description: result.message, status: 'success' })
        queryClient.invalidateQueries({
          queryKey: ['inventory-bundle-components', selectedBundleItem?.id],
        })
      } else {
        showToast({
          title: 'Failed to add component',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const removeBundleComponentMutation = useMutation({
    mutationFn: (componentId: string) => {
      setRemovingComponentId(componentId)
      return removeBundleComponent(selectedBundleItem!.id, componentId)
    },
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Component removed', description: result.message, status: 'success' })
        queryClient.invalidateQueries({
          queryKey: ['inventory-bundle-components', selectedBundleItem?.id],
        })
      } else {
        showToast({
          title: 'Failed to remove component',
          description: result.message,
          status: 'error',
        })
      }
    },
    onSettled: () => setRemovingComponentId(null),
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
    setApprovalStatus(undefined)
    setPrimaryCategoryId(undefined)
    setSortBy('createdAt')
    setSortOrder('desc')
    setPage(1)
  }

  return {
    // Data
    items,
    pagination,
    categories: flatToCategorySelectOptions(categoriesQuery.data?.data?.data ?? []),
    uomOptions: (() => {
      const d = uomQuery.data?.data
      if (!d) return []
      if (Array.isArray(d)) return d
      if (Array.isArray((d as { data?: unknown }).data)) return (d as { data: UomOption[] }).data
      return []
    })(),
    brandOptions: (itemBrandsQuery.data?.data ?? []) as ClassificationOption[],
    typeOptions: (itemTypesQuery.data?.data ?? []) as ClassificationOption[],

    // Loading / Error
    isLoading: itemsQuery.isLoading,
    isFetching: itemsQuery.isFetching,
    error: itemsQuery.error,

    // Filters
    search,
    lifecycle,
    approvalStatus,
    primaryCategoryId,
    setSearch: (val: string) => {
      setSearch(val)
      setPage(1)
    },
    setLifecycle: (val: typeof lifecycle) => {
      setLifecycle(val)
      setPage(1)
    },
    setApprovalStatus: (val: typeof approvalStatus) => {
      setApprovalStatus(val)
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
    limit,
    setLimit: (val: number) => {
      setLimit(val)
      setPage(1)
    },

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

    // Scenario 16 — Item Master Governance
    submitItem: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
    confirmAccounting: (id: string, data: ConfirmAccountingFormValues) =>
      confirmAccountingMutation.mutateAsync({ id, data }),
    isConfirmingAccounting: confirmAccountingMutation.isPending,
    rejectAccounting: (id: string, data: RejectAccountingFormValues) =>
      rejectAccountingMutation.mutateAsync({ id, data }),
    isRejectingAccounting: rejectAccountingMutation.isPending,
    approveItem: (id: string, data: ApproveItemFormValues) =>
      approveItemMutation.mutateAsync({ id, data }),
    isApprovingItem: approveItemMutation.isPending,
    rejectItem: (id: string, data: RejectItemFormValues) =>
      rejectItemMutation.mutateAsync({ id, data }),
    isRejectingItem: rejectItemMutation.isPending,

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
    addBundleComponent: addBundleComponentMutation.mutateAsync,
    isAddingBundleComponent: addBundleComponentMutation.isPending,
    removeBundleComponent: removeBundleComponentMutation.mutateAsync,
    removingComponentId,
  }
}
