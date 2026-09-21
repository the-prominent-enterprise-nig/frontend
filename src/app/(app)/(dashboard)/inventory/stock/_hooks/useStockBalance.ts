'use client'

import type { StockStateFilter } from '@/src/schema/inventory/goods-receiving'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo, useEffect } from 'react'
import { getStockBalances } from '../_actions/get-stock-balances'
import { getCategoriesFlat } from '../../categories/_actions/get-categories-flat'
import { flatToCategorySelectOptions } from '@/src/libs/format/category-tree'
import type { LocationToken } from '@/src/libs/inventory/location-tokens'
import { useLocationFilter } from '@/src/libs/inventory/useLocationFilter'

export function useStockBalance(onLocationsChange?: (v: LocationToken[]) => void) {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  // Scenario 56 — Operations + Branches now come from the shared hook every
  // inventory list uses.
  const locationFilter = useLocationFilter({ onChange: () => setPage(1) })
  const { locations, region, branchIds, warehouseIds } = locationFilter
  const [stockStatus, setStockStatusState] = useState<StockStateFilter | undefined>(undefined)
  const [categoryId, setCategoryIdState] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')

  // Mirrors every selection (explicit picks and the region-narrowing
  // auto-drop below) up to StockHub, so the Ledger tab can inherit it when
  // opened next — same "snapshot at open time" idea as the Item 360 drawer.
  useEffect(() => {
    onLocationsChange?.(locations)
  }, [locations, onLocationsChange])

  const queryParams = useMemo(() => {
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
  }, [page, limit, branchIds, warehouseIds, region, search, stockStatus, categoryId])

  const balancesQuery = useQuery({
    queryKey: ['inventory-stock-balances', queryParams],
    queryFn: () => getStockBalances(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  })

  const categoriesQuery = useQuery({
    queryKey: ['inventory-categories-flat'],
    queryFn: () => getCategoriesFlat({ limit: 500 }),
    staleTime: 5 * 60 * 1000,
  })

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
    setStockStatus: (v: StockStateFilter | undefined) => {
      setStockStatusState(v)
      setPage(1)
    },
    setLocations: locationFilter.setLocations,
    setRegion: locationFilter.setRegion,
    locationFilter,
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
      locationFilter.reset()
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

    locationOptions: locationFilter.locationOptions,
    locationsLoading: locationFilter.locationsLoading,

    categoryOptions: flatToCategorySelectOptions(categoriesQuery.data?.data?.data ?? []),

    refetch: () => balancesQuery.refetch(),
  }
}
