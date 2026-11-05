'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { STALE } from '@/src/libs/query/stale-times'
import { getStockLedger } from '../_actions/get-stock-ledger'
import { getCategories, getItemTypes } from '../../items/_actions/get-lookup-data'
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
  // Type = item type; Category = the client sheet's GROUP (a root category).
  const [typeId, setTypeId] = useState<string | undefined>()
  const [categoryId, setCategoryId] = useState<string | undefined>()

  const groupsQuery = useQuery({
    queryKey: ['inventory-category-groups-lookup'],
    queryFn: () => getCategories({ parentCategoryId: 'null' }),
    staleTime: STALE.LOOKUP,
  })
  const typesQuery = useQuery({
    queryKey: ['inventory-item-types-lookup'],
    queryFn: () => getItemTypes(),
    staleTime: STALE.LOOKUP,
  })

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
      typeId,
      categoryId,
    }),
    [
      page,
      limit,
      branchIds,
      warehouseIds,
      region,
      transactionType,
      startDate,
      endDate,
      search,
      typeId,
      categoryId,
    ]
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
    setTypeId(undefined)
    setCategoryId(undefined)
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
    typeId,
    categoryId,
    groupOptions: groupsQuery.data?.data?.data ?? [],
    typeOptions: typesQuery.data?.data ?? [],
    setTypeId: (v: string | undefined) => {
      setTypeId(v)
      setPage(1)
    },
    setCategoryId: (v: string | undefined) => {
      setCategoryId(v)
      setPage(1)
    },
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
