'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo, useEffect, useRef } from 'react'
import { STALE } from '@/src/libs/query/stale-times'
import { getStockLedger } from '../_actions/get-stock-ledger'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { splitLocationTokens, type LocationToken } from '@/src/libs/inventory/location-tokens'

export function useStockLedger(initialLocations?: LocationToken[]) {
  const [page, setPage] = useState(1)
  const [limit, setLimitState] = useState(25)

  const [warehouseId, setWarehouseId] = useState<string | undefined>()
  const [branchId, setBranchId] = useState<string | undefined>()
  const [transactionType, setTransactionType] = useState<string | undefined>()
  const [startDate, setStartDate] = useState<string | undefined>()
  const [endDate, setEndDate] = useState<string | undefined>()
  const [search, setSearchState] = useState('')

  const params = useMemo(
    () => ({
      page,
      limit,
      warehouseId,
      branchId,
      transactionType,
      startDate,
      endDate,
      search: search.trim() || undefined,
    }),
    [page, limit, warehouseId, branchId, transactionType, startDate, endDate, search]
  )

  const ledgerQuery = useQuery({
    queryKey: ['inventory-stock-ledger-full', params],
    queryFn: () => getStockLedger(params),
    placeholderData: keepPreviousData,
    staleTime: STALE.REALTIME,
  })

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active' }),
    staleTime: STALE.LOOKUP,
  })

  // Inherit the Balance tab's location filter when this tab is opened —
  // same "snapshot at open time" idea as the Item 360 drawer. Only seeded
  // once, and only when it resolves unambiguously to one location: this
  // dropdown is single-select, so 0 or 2+ picked locations just stay "All
  // Locations" rather than guessing which one to apply.
  const seededRef = useRef(false)
  useEffect(() => {
    if (seededRef.current) return
    if (!initialLocations?.length || warehousesQuery.isLoading) return
    seededRef.current = true
    const { branchIds, warehouseIds } = splitLocationTokens(initialLocations)
    if (warehouseIds.length === 1 && branchIds.length === 0) {
      setWarehouseId(warehouseIds[0])
    } else if (branchIds.length === 1 && warehouseIds.length === 0) {
      const warehouses = warehousesQuery.data?.data?.data ?? []
      const match = warehouses.find((wh) => wh.branch?.id === branchIds[0])
      if (match) setWarehouseId(match.id)
    }
  }, [initialLocations, warehousesQuery.isLoading, warehousesQuery.data])

  const entries = ledgerQuery.data?.data?.data ?? []
  const total = ledgerQuery.data?.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / limit))

  function resetFilters() {
    setWarehouseId(undefined)
    setBranchId(undefined)
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

    warehouseId,
    branchId,
    transactionType,
    startDate,
    endDate,
    setWarehouseId: (v: string | undefined) => {
      setWarehouseId(v)
      setPage(1)
    },
    search,
    setSearch: (v: string) => {
      setSearchState(v)
      setPage(1)
    },
    setBranchId: (v: string | undefined) => {
      setBranchId(v)
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

    warehouseOptions: warehousesQuery.data?.data?.data ?? [],
    warehousesLoading: warehousesQuery.isLoading,
  }
}
