'use client'

import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getSerialNumbers } from '../_actions/get-serial-numbers'
import { getCaravanItemGroups } from '../_actions/get-caravan-item-groups'
import { registerSerialNumbers } from '../_actions/register-serial-numbers'
import { updateSerialStatus } from '../_actions/update-serial-status'
import { closeConsignment } from '../_actions/close-consignment'
import { consignToBranch } from '../_actions/consign-to-branch'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getItems } from '../../items/_actions/get-items'
import { getCategoriesFlat } from '../../categories/_actions/get-categories-flat'
import { getBranches } from '../../purchase-requests/_actions/get-branches'
import { getCustomers } from '@/src/libs/data/AccountingData'
import { flatToCategorySelectOptions } from '@/src/libs/format/category-tree'
import type {
  RegisterSerialsFormInput,
  UpdateSerialStatusFormValues,
  SerialStatus,
  ConsignToBranchFormValues,
} from '@/src/schema/inventory/serial-numbers'
import { caravanGroupKey } from '@/src/schema/inventory/serial-numbers'
import { useLocationFilter } from '@/src/libs/inventory/useLocationFilter'

export function useSerialNumbers() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [statusFilter, setStatusFilter] = useState<SerialStatus | undefined>(undefined)
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined)
  const [brandFilter, setBrandFilter] = useState<string | undefined>(undefined)
  // Scenario 56 — Operations + multi-select Branches, shared with the other
  // inventory lists (was a single warehouse picker).
  const locationFilter = useLocationFilter({ onChange: () => setPage(1) })
  const { branchIds, warehouseIds, region } = locationFilter
  const [search, setSearch] = useState<string | undefined>(undefined)

  // Scenario 08 (Caravan) Part 2 — "Caravan" view. A branch-restricted
  // viewer's own branch is forced server-side regardless of what's sent here;
  // caravanBranchId only matters for an unrestricted Business Owner explicitly
  // checking a specific branch (see SerialNumberList's branch picker).
  const [caravanView, setCaravanView] = useState(false)
  const [caravanBranchId, setCaravanBranchId] = useState<string | undefined>(undefined)

  // Scenario 08 (Caravan) — "By Item" vs "By Serial" within the Caravan tab.
  // Serials lead: this is the Serial Number Tracking page, and the unit-level
  // actions (Return to Origin, Move onward) live on that list. The item
  // rollup is the summary you switch to, not the way in.
  const [caravanGrouping, setCaravanGrouping] = useState<'item' | 'serial'>('serial')
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null)

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
            brandId: brandFilter,
            branchIds,
            warehouseIds,
            region,
            search,
          },
    [
      page,
      limit,
      statusFilter,
      categoryFilter,
      brandFilter,
      branchIds,
      warehouseIds,
      region,
      search,
      caravanView,
      caravanBranchId,
    ]
  )

  // The Caravan tab opens on every consignment in the company and narrows
  // from there — the 'caravan' sentinel the queries send when no branch is
  // picked means "all of them" backend-side, so nothing has to be picked
  // before the tab shows anything. A branch-restricted caller is still
  // forced to their own branch server-side, so there is nothing to gate on
  // here either; kept as a named constant so the callers that still read it
  // (the table's render guard) stay legible.
  const caravanReady = true

  // The item rollup is its own paginated list, so the serial list stands down
  // entirely while "By Item" is showing rather than paging in the background.
  const groupedCaravan = caravanView && caravanGrouping === 'item'

  const serialsQuery = useQuery({
    queryKey: ['inventory-serial-numbers', queryParams],
    queryFn: () => getSerialNumbers(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    enabled: caravanReady && !groupedCaravan,
  })

  const caravanGroupParams = useMemo(
    () => ({
      page,
      limit,
      categoryId: categoryFilter,
      status: statusFilter,
      search,
      consignedToBranchId: caravanBranchId ?? 'caravan',
    }),
    [page, limit, categoryFilter, statusFilter, search, caravanBranchId]
  )

  const caravanGroupsQuery = useQuery({
    queryKey: ['inventory-caravan-item-groups', caravanGroupParams],
    queryFn: () => getCaravanItemGroups(caravanGroupParams),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    enabled: caravanReady && groupedCaravan,
  })

  // Units behind the one expanded group. The list endpoint can narrow to the
  // item but has no venue/event filter, so a second group of the same item is
  // filtered out here by the shared rollup key rather than by re-querying.
  const expandedGroup = (caravanGroupsQuery.data?.data?.data ?? []).find(
    (g) => g.key === expandedGroupKey
  )
  const expandedSerialsQuery = useQuery({
    queryKey: ['inventory-caravan-group-serials', expandedGroupKey, caravanGroupParams],
    queryFn: () =>
      getSerialNumbers({
        ...caravanGroupParams,
        page: 1,
        // One group is one item at one event — a few dozen units at most in
        // practice, and there is no drill-down pagination to fall back on.
        limit: 200,
        itemId: expandedGroup?.item?.id,
      }),
    staleTime: 30 * 1000,
    enabled: !!expandedGroupKey && !!expandedGroup?.item?.id,
  })
  const expandedSerials = (expandedSerialsQuery.data?.data?.data ?? []).filter(
    (s) => caravanGroupKey(s) === expandedGroupKey
  )

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

  // Only needed for the "Change Status" modal's "sold to" picker (Scenario:
  // Serial Numbers tab revamp). `getCustomers` returns either a flat array
  // or `{ items, total, page, limit }` depending on whether the backend
  // paginated — normalized to a flat array here so callers don't have to
  // know about that union.
  const customersQuery = useQuery({
    queryKey: ['inventory-customers-lookup'],
    queryFn: () => getCustomers({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  })

  // Metric band on the All Serials tab — counts across every matching
  // record, not just the current page, so each bucket is its own limit:1
  // request (only `meta.total` is read from it). "Reserved" reads the
  // `held` status (the schema has no literal "reserved" value).
  const STATUS_COUNT_BUCKETS = ['in_stock', 'held', 'sold', 'returned', 'pulled_out'] as const
  const statusCountQueries = useQueries({
    queries: STATUS_COUNT_BUCKETS.map((status) => ({
      queryKey: ['inventory-serial-status-count', status],
      queryFn: () => getSerialNumbers({ status, limit: 1 }),
      staleTime: 30 * 1000,
      enabled: !caravanView,
    })),
  })
  const statusCounts = STATUS_COUNT_BUCKETS.reduce(
    (acc, status, i) => {
      acc[status] = statusCountQueries[i]?.data?.data?.total ?? 0
      return acc
    },
    {} as Record<(typeof STATUS_COUNT_BUCKETS)[number], number>
  )

  const registerMutation = useMutation({
    mutationFn: (data: RegisterSerialsFormInput) => registerSerialNumbers(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Serials registered', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-serial-numbers'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-serial-status-count'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-caravan-item-groups'] })
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
        queryClient.invalidateQueries({ queryKey: ['inventory-serial-status-count'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-caravan-item-groups'] })
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
        queryClient.invalidateQueries({ queryKey: ['inventory-serial-status-count'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-caravan-item-groups'] })
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
        queryClient.invalidateQueries({ queryKey: ['inventory-serial-status-count'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-caravan-item-groups'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const serials = serialsQuery.data?.data?.data ?? []
  // Whichever list is on screen owns the pager — "By Item" pages over groups,
  // not over units, so its own total is the one the footer must count.
  const activeList = groupedCaravan ? caravanGroupsQuery : serialsQuery
  const pagination = {
    total: activeList.data?.data?.total ?? 0,
    page: activeList.data?.data?.page ?? 1,
    limit: activeList.data?.data?.limit ?? limit,
    totalPages: Math.ceil((activeList.data?.data?.total ?? 0) / limit),
  }

  return {
    serials,
    pagination,
    statusCounts,
    isLoading: activeList.isLoading,
    isFetching: activeList.isFetching,
    error: activeList.error,

    statusFilter,
    categoryFilter,
    brandFilter,
    locationFilter,
    search,
    setStatusFilter: (v: SerialStatus | undefined) => {
      setStatusFilter(v)
      setPage(1)
    },
    setCategoryFilter: (v: string | undefined) => {
      setCategoryFilter(v)
      setPage(1)
    },
    setBrandFilter: (v: string | undefined) => {
      setBrandFilter(v)
      setPage(1)
    },
    setSearch: (v: string | undefined) => {
      setSearch(v)
      setPage(1)
    },
    resetFilters: () => {
      setStatusFilter(undefined)
      setCategoryFilter(undefined)
      setBrandFilter(undefined)
      locationFilter.reset()
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
    // Scenario 50 Gap 6 - a caravan host must be a real branch, not one of
    // the 2 warehouse-branches (NWHSE/PWHSE, Scenario 27's leftover). /branches
    // has no server-side type filter, so this stays a plain client-side
    // exclusion rather than a systemic fix - the same gap exists in several
    // other pickers across the app and is explicitly out of scope here.
    branchOptions: (branchesQuery.data?.data?.data ?? []).filter((b) => b.type !== 'warehouse'),
    customerOptions: (() => {
      const raw = customersQuery.data?.data
      if (!raw) return []
      const list = Array.isArray(raw) ? raw : (raw.items ?? [])
      return list.map((c) => ({ id: String(c.id), name: c.name }))
    })(),

    caravanView,
    setCaravanView: (v: boolean) => {
      setCaravanView(v)
      setPage(1)
      setExpandedGroupKey(null)
      setSelectedIds(new Set())
    },
    caravanBranchId,
    setCaravanBranchId: (v: string | undefined) => {
      setCaravanBranchId(v)
      setPage(1)
      setExpandedGroupKey(null)
      setSelectedIds(new Set())
    },
    caravanReady,
    caravanGrouping,
    setCaravanGrouping: (v: 'item' | 'serial') => {
      setCaravanGrouping(v)
      setPage(1)
      setExpandedGroupKey(null)
      setSelectedIds(new Set())
    },
    caravanGroups: caravanGroupsQuery.data?.data?.data ?? [],
    isLoadingCaravanGroups: caravanGroupsQuery.isLoading,
    caravanGroupsError: caravanGroupsQuery.error,
    expandedGroupKey,
    toggleExpandedGroup: (key: string) =>
      setExpandedGroupKey((prev) => (prev === key ? null : key)),
    expandedSerials,
    isLoadingExpandedSerials: expandedSerialsQuery.isLoading,

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

    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-serial-numbers'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-caravan-item-groups'] })
    },
  }
}
