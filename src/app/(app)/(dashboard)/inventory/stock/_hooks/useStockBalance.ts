'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { getStockBalances } from '../_actions/get-stock-balances'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'

export function useStockBalance() {
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [belowReorder, setBelowReorder] = useState(false)

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      warehouseId: warehouseFilter,
      search: search || undefined,
      belowReorder: belowReorder || undefined,
    }),
    [page, limit, warehouseFilter, search, belowReorder]
  )

  const balancesQuery = useQuery({
    queryKey: ['inventory-stock-balances', queryParams],
    queryFn: () => getStockBalances(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  })

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  const balances = balancesQuery.data?.data?.data ?? []
  const pagination = {
    total: balancesQuery.data?.data?.total ?? 0,
    page: balancesQuery.data?.data?.page ?? 1,
    limit: balancesQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((balancesQuery.data?.data?.total ?? 0) / limit),
  }

  return {
    balances,
    pagination,
    isLoading: balancesQuery.isLoading,
    isFetching: balancesQuery.isFetching,
    error: balancesQuery.error,

    warehouseFilter,
    search,
    belowReorder,
    setWarehouseFilter: (v: string | undefined) => {
      setWarehouseFilter(v)
      setPage(1)
    },
    setSearch: (v: string) => {
      setSearch(v)
      setPage(1)
    },
    setBelowReorder: (v: boolean) => {
      setBelowReorder(v)
      setPage(1)
    },
    resetFilters: () => {
      setWarehouseFilter(undefined)
      setSearch('')
      setBelowReorder(false)
      setPage(1)
    },

    page,
    setPage,

    warehouseOptions: warehousesQuery.data?.data?.data ?? [],

    refetch: () => balancesQuery.refetch(),
  }
}
