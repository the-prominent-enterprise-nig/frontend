'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { STALE } from '@/src/libs/query/stale-times'
import { getStockLedger } from '../_actions/get-stock-ledger'
import type { LocationToken } from '@/src/libs/inventory/location-tokens'
import { useLocationFilter } from '@/src/libs/inventory/useLocationFilter'

export function useStockLedger(initialLocations?: LocationToken[]) {
  const [page, setPage] = useState(1)
  const [limit, setLimitState] = useState(25)

  // Scenario 56 — the same Operations + multi-select Branches filter as
  // Stock Balance, seeded with whatever was picked there when this tab
  // opened (all of it now, not only when it happened to be one location).
  const locationFilter = useLocationFilter({
    initialLocations,
    onChange: () => setPage(1),
  })
  const { branchIds, warehouseIds, region } = locationFilter
  const [transactionType, setTransactionType] = useState<string | undefined>()
  const [startDate, setStartDate] = useState<string | undefined>()
  const [endDate, setEndDate] = useState<string | undefined>()
  const [search, setSearchState] = useState('')

  const params = useMemo(
    () => ({
      page,
      limit,
      branchIds,
      warehouseIds,
      region,
      transactionType,
      startDate,
      endDate,
      search: search.trim() || undefined,
    }),
    [page, limit, branchIds, warehouseIds, region, transactionType, startDate, endDate, search]
  )

  const ledgerQuery = useQuery({
    queryKey: ['inventory-stock-ledger-full', params],
    queryFn: () => getStockLedger(params),
    placeholderData: keepPreviousData,
    staleTime: STALE.REALTIME,
  })

  const entries = ledgerQuery.data?.data?.data ?? []
  const total = ledgerQuery.data?.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / limit))

  function resetFilters(): void {
    locationFilter.reset()
    setTransactionType(undefined)
    setStartDate(undefined)
    setEndDate(undefined)
    setSearchState('')
    setPage(1)
  }

  return {
    entries,
    total,
    page,
    limit,
    totalPages,
    isLoading: ledgerQuery.isLoading,
    isFetching: ledgerQuery.isFetching,
    error: ledgerQuery.error,
    refetch: ledgerQuery.refetch,

    locationFilter,
    transactionType,
    startDate,
    endDate,
    search,
    setSearch: (v: string) => {
      setSearchState(v)
      setPage(1)
    },
    setTransactionType: (v: string | undefined) => {
      setTransactionType(v)
      setPage(1)
    },
    setStartDate: (v: string | undefined) => {
      setStartDate(v)
      setPage(1)
    },
    setEndDate: (v: string | undefined) => {
      setEndDate(v)
      setPage(1)
    },
    resetFilters,
    setPage,
    setLimit: (v: number) => {
      setLimitState(v)
      setPage(1)
    },
  }
}
