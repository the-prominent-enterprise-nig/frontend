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
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getItems } from '../../items/_actions/get-items'
import { getCategoriesFlat } from '../../categories/_actions/get-categories-flat'
import { flatToCategorySelectOptions } from '@/src/libs/format/category-tree'
import type {
  RegisterSerialsFormInput,
  SerialStatus,
  SerialNumberSummary,
} from '@/src/schema/inventory/serial-numbers'
import { isCaravanBranch, warehouseLabel } from '@/src/schema/inventory/warehouses'
import { caravanGroupKey } from '@/src/schema/inventory/serial-numbers'
import { useLocationFilter } from '@/src/libs/inventory/useLocationFilter'

// An opened caravan row lists what is still there first: on hand, then on
// its way out, then everything already gone.
const UNIT_STATUS_ORDER: SerialStatus[] = ['in_stock', 'held', 'in_transit', 'sold']
function unitStatusRank(status: SerialStatus): number {
  const i = UNIT_STATUS_ORDER.indexOf(status)
  return i === -1 ? UNIT_STATUS_ORDER.length : i
}

export function useSerialNumbers(
  // Scenario 60 Part 3 — opens straight onto one caravan (`?caravan=` deep link).
  opts: { initialCaravanId?: string } = {}
) {
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

  // Scenario 60 — "Caravan" view: units sitting in caravan warehouses (they
  // got there on an ordinary Stock Transfer). No caravan picked means every
  // caravan; a branch-restricted viewer only ever sees the caravans their
  // own branch hosts, enforced server-side.
  const [caravanView, setCaravanView] = useState(!!opts.initialCaravanId)
  const [caravanId, setCaravanId] = useState<string | undefined>(opts.initialCaravanId)

  // Scenario 60 — the Caravan tab is one list: a row per item per caravan
  // that opens onto its units. Rows start closed, except while searching,
  // when every matching item starts open so a typed serial is on screen
  // straight away. `toggledKeys` holds the rows flipped from that default,
  // and is cleared whenever the list itself changes.
  const [toggledKeys, setToggledKeys] = useState<ReadonlySet<string>>(new Set())

  const queryParams = useMemo(
    () =>
      caravanView
        ? {
            page,
            limit,
            categoryId: categoryFilter,
            status: statusFilter,
            search,
            caravanId: caravanId ?? 'caravan',
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
      caravanId,
    ]
  )

  // The Caravan tab opens on every caravan and narrows from there — the
  // 'caravan' sentinel the queries send when none is picked means "all of
  // them" backend-side, so nothing has to be picked before the tab shows
  // anything. Kept as a named constant so the table's render guard stays
  // legible.
  const caravanReady = true

  // The item rollup is its own paginated list, so the serial list stands down
  // entirely on the Caravan tab rather than paging in the background.
  const groupedCaravan = caravanView

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
      caravanId: caravanId ?? 'caravan',
    }),
    [page, limit, categoryFilter, statusFilter, search, caravanId]
  )

  const caravanGroupsQuery = useQuery({
    queryKey: ['inventory-caravan-item-groups', caravanGroupParams],
    queryFn: () => getCaravanItemGroups(caravanGroupParams),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    enabled: caravanReady && groupedCaravan,
  })

  const caravanGroups = caravanGroupsQuery.data?.data?.data ?? []
  const isGroupOpen = (key: string): boolean => toggledKeys.has(key) !== !!search

  // While searching, one fetch covers every open row: the same search over
  // the same caravans returns exactly the units the matching groups count.
  const searchedSerialsQuery = useQuery({
    queryKey: ['inventory-caravan-searched-serials', caravanGroupParams],
    queryFn: () => getSerialNumbers({ ...caravanGroupParams, page: 1, limit: 200 }),
    staleTime: 30 * 1000,
    enabled: groupedCaravan && !!search,
  })

  // Otherwise each open row fetches its own units. One group is one item at
  // one caravan — a few dozen units at most in practice, so no pagination
  // inside a row. Narrowed by the group's own caravan and item, then by the
  // rollup key in case the caravan holds more than one warehouse.
  const openGroups = search ? [] : caravanGroups.filter((g) => isGroupOpen(g.key))
  const groupSerialQueries = useQueries({
    queries: openGroups.map((group) => ({
      queryKey: ['inventory-caravan-group-serials', group.key, caravanGroupParams],
      queryFn: () =>
        getSerialNumbers({
          ...caravanGroupParams,
          caravanId: group.caravan?.id ?? caravanGroupParams.caravanId,
          itemId: group.item?.id,
          page: 1,
          limit: 200,
        }),
      staleTime: 30 * 1000,
      enabled: !!group.item?.id,
    })),
  })

  const groupSerials = (key: string): { serials: SerialNumberSummary[]; isLoading: boolean } => {
    const query = search
      ? searchedSerialsQuery
      : groupSerialQueries[openGroups.findIndex((g) => g.key === key)]
    const serials = (query?.data?.data?.data ?? [])
      .filter((s) => caravanGroupKey(s) === key)
      .sort((a, b) => unitStatusRank(a.status) - unitStatusRank(b.status))
    return { serials, isLoading: query?.isLoading ?? false }
  }

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

  // Metric band on the All Serials tab — counts across every matching
  // record, not just the current page, so each bucket is its own limit:1
  // request (only `meta.total` is read from it). "Reserved" is the `held`
  // status; in_repair + defective + pulled_out fold into one "Service" cell.
  const STATUS_COUNT_BUCKETS = [
    'in_stock',
    'held',
    'in_transit',
    'in_repair',
    'defective',
    'pulled_out',
    'sold',
  ] as const
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
      setToggledKeys(new Set())
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

    caravanView,
    setCaravanView: (v: boolean) => {
      setCaravanView(v)
      setPage(1)
      setToggledKeys(new Set())
    },
    caravanId,
    setCaravanId: (v: string | undefined) => {
      setCaravanId(v)
      setPage(1)
      setToggledKeys(new Set())
    },
    // Every caravan the viewer can see, ended ones included — stock left in
    // an ended caravan still has to be found and transferred out.
    caravanOptions: (warehousesQuery.data?.data?.data ?? [])
      .filter((wh) => isCaravanBranch(wh.branch))
      .map((wh) => ({ value: wh.branch?.id as string, label: warehouseLabel(wh) })),
    caravanReady,
    caravanGroups,
    isLoadingCaravanGroups: caravanGroupsQuery.isLoading,
    caravanGroupsError: caravanGroupsQuery.error,
    isGroupOpen,
    toggleGroup: (key: string) =>
      setToggledKeys((prev) => {
        const next = new Set(prev)
        if (!next.delete(key)) next.add(key)
        return next
      }),
    groupSerials,

    registerSerials: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,

    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-serial-numbers'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-caravan-item-groups'] })
    },
  }
}
