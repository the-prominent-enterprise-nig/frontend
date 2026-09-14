'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo, useEffect } from 'react'
import { getStockBalances } from '../_actions/get-stock-balances'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getBranches } from '../../price-lists/_actions/get-branches'
import { getCategoriesFlat } from '../../categories/_actions/get-categories-flat'
import { flatToCategorySelectOptions } from '@/src/libs/format/category-tree'
import {
  branchToken,
  splitLocationTokens,
  warehouseToken,
  type LocationToken,
} from '@/src/libs/inventory/location-tokens'

export function useStockBalance(onLocationsChange?: (v: LocationToken[]) => void) {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [locations, setLocations] = useState<LocationToken[]>([])
  const [region, setRegion] = useState<'panay' | 'negros' | undefined>(undefined)
  const [stockStatus, setStockStatusState] = useState<'in_stock' | 'in_transit' | undefined>(
    undefined
  )
  const [categoryId, setCategoryIdState] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')

  // Mirrors every selection (explicit picks and the region-narrowing
  // auto-drop below) up to StockHub, so the Ledger tab can inherit it when
  // opened next — same "snapshot at open time" idea as the Item 360 drawer.
  useEffect(() => {
    onLocationsChange?.(locations)
  }, [locations, onLocationsChange])

  const queryParams = useMemo(() => {
    const { branchIds, warehouseIds } = splitLocationTokens(locations)
    return {
      page,
      limit,
      // The client's list is read as "how many of this model do we have",
      // so the screen always asks for the rolled-up shape.
      groupBy: 'item' as const,
      stockStatus,
      branchIds,
      warehouseIds,
      region,
      categoryId,
      search: search || undefined,
    }
  }, [page, limit, locations, region, search, stockStatus, categoryId])

  const balancesQuery = useQuery({
    queryKey: ['inventory-stock-balances', queryParams],
    queryFn: () => getStockBalances(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  })

  // Scenario 50 — the location picker lists real branches plus the 2
  // genuinely standalone warehouses. It used to list all 43 warehouse rows
  // and label each `branch?.name ?? name`, which collapsed a branch's shadow
  // warehouse onto the same visible label as the real one — the "2 Panay
  // warehouses" the client reported.
  // Query key must stay distinct from the Serial Numbers tab's
  // `['branches-lookup']` — that hook calls a differently-shaped getBranches
  // (raw ApiResponse wrapper vs. this one's plain Branch[]), and a shared
  // key meant whichever query populated the cache first fed its shape to
  // both consumers, crashing here with "(branchesQuery.data ?? []).filter
  // is not a function" whenever Serial Numbers had loaded first.
  const branchesQuery = useQuery({
    queryKey: ['inventory-stock-balance-branches'],
    queryFn: () => getBranches(),
    staleTime: 5 * 60 * 1000,
  })

  const standaloneWarehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-standalone'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active', standaloneOnly: true }),
    staleTime: 5 * 60 * 1000,
  })

  const categoriesQuery = useQuery({
    queryKey: ['inventory-categories-flat'],
    queryFn: () => getCategoriesFlat({ limit: 500 }),
    staleTime: 5 * 60 * 1000,
  })

  // Every location the picker could offer, each tagged with the region it
  // belongs to so Operations can narrow the list below.
  const allLocationOptions = useMemo(() => {
    // `type: 'warehouse'` branches (NWHSE/PWHSE) are bookkeeping rows for the
    // 2 standalone warehouses, which are listed below in their own right —
    // offering both would put "Panay" in the picker twice again.
    const branches = (branchesQuery.data ?? [])
      .filter((b) => b.type !== 'warehouse')
      .map((b) => ({
        value: branchToken(b.id),
        label: b.name,
        region: b.region ?? null,
      }))

    const warehouses = (standaloneWarehousesQuery.data?.data?.data ?? []).map((wh) => ({
      value: warehouseToken(wh.id),
      label: wh.name,
      region: wh.region ?? null,
    }))

    return [...warehouses, ...branches].sort((a, b) => a.label.localeCompare(b.label))
  }, [branchesQuery.data, standaloneWarehousesQuery.data])

  // Operations is the first filter: picking one narrows Branches to that
  // region's locations, so the two filters can never disagree. A location
  // with no region recorded is hidden while an operation is selected rather
  // than shown under both — it genuinely belongs to neither.
  const locationOptions = useMemo(
    () =>
      region
        ? allLocationOptions.filter((o) => o.region === region)
        : allLocationOptions.map(({ value, label }) => ({ value, label })),
    [allLocationOptions, region]
  )

  const balances = balancesQuery.data?.data?.data ?? []
  const summary = balancesQuery.data?.data?.summary
  const pagination = {
    total: balancesQuery.data?.data?.total ?? 0,
    page: balancesQuery.data?.data?.page ?? 1,
    limit: balancesQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((balancesQuery.data?.data?.total ?? 0) / limit),
  }

  return {
    balances,
    summary,
    pagination,
    isLoading: balancesQuery.isLoading,
    isFetching: balancesQuery.isFetching,
    error: balancesQuery.error,

    locations,
    region,
    stockStatus,
    search,
    setStockStatus: (v: 'in_stock' | 'in_transit' | undefined) => {
      setStockStatusState(v)
      setPage(1)
    },
    setLocations: (v: LocationToken[]) => {
      setLocations(v)
      setPage(1)
    },
    setRegion: (v: 'panay' | 'negros' | undefined) => {
      setRegion(v)
      // Drop any already-picked location that the new operation excludes —
      // leaving it selected would keep filtering by a branch the user can no
      // longer see in the picker.
      if (v) {
        const allowed = new Set(
          allLocationOptions.filter((o) => o.region === v).map((o) => o.value)
        )
        setLocations((prev) => prev.filter((token) => allowed.has(token)))
      }
      setPage(1)
    },
    setSearch: (v: string) => {
      setSearch(v)
      setPage(1)
    },
    categoryId,
    setCategoryId: (v: string | undefined) => {
      setCategoryIdState(v)
      setPage(1)
    },
    resetFilters: () => {
      setLocations([])
      setRegion(undefined)
      setStockStatusState(undefined)
      setCategoryIdState(undefined)
      setSearch('')
      setPage(1)
    },

    page,
    setPage,
    limit,
    setLimit: (v: number) => {
      setLimit(v)
      setPage(1)
    },

    locationOptions,
    locationsLoading: branchesQuery.isLoading || standaloneWarehousesQuery.isLoading,

    categoryOptions: flatToCategorySelectOptions(categoriesQuery.data?.data?.data ?? []),

    refetch: () => balancesQuery.refetch(),
  }
}
