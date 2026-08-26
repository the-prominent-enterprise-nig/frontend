'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getSerialNumbers } from '../_actions/get-serial-numbers'
import { registerSerialNumbers } from '../_actions/register-serial-numbers'
import { updateSerialStatus } from '../_actions/update-serial-status'
import { closeConsignment } from '../_actions/close-consignment'
import { consignToBranch } from '../_actions/consign-to-branch'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getItems } from '../../items/_actions/get-items'
import { getCategoriesFlat } from '../../categories/_actions/get-categories-flat'
import { getBranches } from '../../purchase-requests/_actions/get-branches'
import { flatToCategorySelectOptions } from '@/src/libs/format/category-tree'
import type {
  RegisterSerialsFormInput,
  UpdateSerialStatusFormValues,
  SerialStatus,
  ConsignToBranchFormValues,
} from '@/src/schema/inventory/serial-numbers'

export function useSerialNumbers(isBranchRestricted: boolean) {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [statusFilter, setStatusFilter] = useState<SerialStatus | undefined>(undefined)
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined)
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState<string | undefined>(undefined)

  // Scenario 08 (Caravan) Part 2 — "Caravan" view. A branch-restricted
  // viewer's own branch is forced server-side regardless of what's sent here;
  // caravanBranchId only matters for an unrestricted Business Owner explicitly
  // checking a specific branch (see SerialNumberList's branch picker).
  const [caravanView, setCaravanView] = useState(false)
  const [caravanBranchId, setCaravanBranchId] = useState<string | undefined>(undefined)

  // Scenario 08 (Caravan) Part 4 — event close. Selection only makes sense
  // within the caravan view; cleared whenever the view/branch/page changes
  // so a stale selection can never carry over to a different result set.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const queryParams = useMemo(
    () =>
      caravanView
        ? {
            page,
            limit,
            categoryId: categoryFilter,
            status: statusFilter,
            search,
            consignedToBranchId: caravanBranchId ?? 'caravan',
          }
        : {
            page,
            limit,
            status: statusFilter,
            categoryId: categoryFilter,
            warehouseId: warehouseFilter,
            search,
          },
    [
      page,
      limit,
      statusFilter,
      categoryFilter,
      warehouseFilter,
      search,
      caravanView,
      caravanBranchId,
    ]
  )

  // In caravan view, an unrestricted (Business Owner) caller needs an
  // explicit branch pick first — there's no "own branch" to default to and
  // sending the raw 'caravan' sentinel as a literal branch id would just
  // silently return zero rows instead of prompting for a real pick.
  const caravanReady = !caravanView || isBranchRestricted || !!caravanBranchId

  const serialsQuery = useQuery({
    queryKey: ['inventory-serial-numbers', queryParams],
    queryFn: () => getSerialNumbers(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    enabled: caravanReady,
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

  const categoriesQuery = useQuery({
    queryKey: ['inventory-categories-flat'],
    queryFn: () => getCategoriesFlat({ limit: 500 }),
    staleTime: 5 * 60 * 1000,
  })

  // Needed for both the Caravan tab's branch picker and the All Serials
  // tab's "Consign to Branch" host-branch picker — no longer gated to
  // caravanView alone.
  const branchesQuery = useQuery({
    queryKey: ['branches-lookup'],
    queryFn: () => getBranches(),
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

  const consignMutation = useMutation({
    mutationFn: ({ ids, data }: { ids: string[]; data: ConsignToBranchFormValues }) =>
      consignToBranch(ids, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Consigned', description: result.message, status: 'success' })
        setSelectedIds(new Set())
        queryClient.invalidateQueries({ queryKey: ['inventory-serial-numbers'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const closeConsignmentMutation = useMutation({
    mutationFn: ({ ids, targetBranchId }: { ids: string[]; targetBranchId?: string }) =>
      closeConsignment(ids, targetBranchId),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Done', description: result.message, status: 'success' })
        setSelectedIds(new Set())
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
    categoryFilter,
    warehouseFilter,
    search,
    setStatusFilter: (v: SerialStatus | undefined) => {
      setStatusFilter(v)
      setPage(1)
    },
    setCategoryFilter: (v: string | undefined) => {
      setCategoryFilter(v)
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
      setCategoryFilter(undefined)
      setWarehouseFilter(undefined)
      setSearch(undefined)
      setPage(1)
    },

    page,
    setPage,
    limit,
    setLimit: (v: number) => {
      setLimit(v)
      setPage(1)
    },

    warehouseOptions: warehousesQuery.data?.data?.data ?? [],
    itemOptions: itemsQuery.data?.data?.data ?? [],
    categoryOptions: flatToCategorySelectOptions(categoriesQuery.data?.data?.data ?? []),
    branchOptions: branchesQuery.data?.data?.data ?? [],

    caravanView,
    setCaravanView: (v: boolean) => {
      setCaravanView(v)
      setPage(1)
      setSelectedIds(new Set())
    },
    caravanBranchId,
    setCaravanBranchId: (v: string | undefined) => {
      setCaravanBranchId(v)
      setPage(1)
      setSelectedIds(new Set())
    },
    caravanReady,

    selectedIds,
    toggleSelected: (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    },
    toggleSelectAll: () => {
      setSelectedIds((prev) =>
        prev.size === serials.length ? new Set() : new Set(serials.map((s) => s.id))
      )
    },
    clearSelection: () => setSelectedIds(new Set()),

    closeConsignment: (targetBranchId?: string) =>
      closeConsignmentMutation.mutateAsync({ ids: [...selectedIds], targetBranchId }),
    isClosingConsignment: closeConsignmentMutation.isPending,

    consignToBranch: (data: ConsignToBranchFormValues) =>
      consignMutation.mutateAsync({ ids: [...selectedIds], data }),
    isConsigning: consignMutation.isPending,

    registerSerials: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,

    updateStatus: updateStatusMutation.mutateAsync,
    isUpdatingStatus: updateStatusMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-serial-numbers'] }),
  }
}
