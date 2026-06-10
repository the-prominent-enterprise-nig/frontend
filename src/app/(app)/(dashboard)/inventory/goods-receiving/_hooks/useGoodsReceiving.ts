'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { STALE } from '@/src/libs/query/stale-times'
import { getStockBalances } from '../_actions/get-stock-balances'
import { getStockLedger } from '../_actions/get-stock-ledger'
import { receiveStock } from '../_actions/receive-stock'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getItems } from '../../items/_actions/get-items'
import type { ReceiveStockFormValues } from '@/src/schema/inventory/goods-receiving'

export function useGoodsReceiving() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>(undefined)
  const [itemFilter, setItemFilter] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState<string | undefined>(undefined)
  const [ledgerItemId, setLedgerItemId] = useState<string | undefined>(undefined)

  const queryParams = useMemo(
    () => ({ page, limit, warehouseId: warehouseFilter, itemId: itemFilter, search }),
    [page, limit, warehouseFilter, itemFilter, search]
  )

  const balancesQuery = useQuery({
    queryKey: ['inventory-stock-balances', queryParams],
    queryFn: () => getStockBalances(queryParams),
    placeholderData: keepPreviousData,
    staleTime: STALE.REALTIME,
  })

  const ledgerQuery = useQuery({
    queryKey: ['inventory-stock-ledger', ledgerItemId],
    queryFn: () => getStockLedger({ itemId: ledgerItemId, limit: 50 }),
    enabled: !!ledgerItemId,
    staleTime: STALE.REALTIME,
  })

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active' }),
    staleTime: STALE.LOOKUP,
  })

  const itemsQuery = useQuery({
    queryKey: ['inventory-items-lookup'],
    queryFn: () => getItems({ limit: 200 }),
    staleTime: STALE.LOOKUP,
  })

  const receiveMutation = useMutation({
    mutationFn: (data: ReceiveStockFormValues) => receiveStock(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Stock received', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-stock-balances'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-stock-ledger'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-item-360'] })
      } else {
        showToast({
          title: 'Failed to receive stock',
          description: result.message,
          status: 'error',
        })
      }
    },
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
    itemFilter,
    search,
    setWarehouseFilter: (v: string | undefined) => {
      setWarehouseFilter(v)
      setPage(1)
    },
    setItemFilter: (v: string | undefined) => {
      setItemFilter(v)
      setPage(1)
    },
    setSearch: (v: string | undefined) => {
      setSearch(v)
      setPage(1)
    },
    resetFilters: () => {
      setWarehouseFilter(undefined)
      setItemFilter(undefined)
      setSearch(undefined)
      setPage(1)
    },

    page,
    setPage,

    ledgerEntries: ledgerQuery.data?.data?.data ?? [],
    isLoadingLedger: ledgerQuery.isLoading,
    ledgerItemId,
    setLedgerItemId,

    warehouseOptions: warehousesQuery.data?.data?.data ?? [],
    itemOptions: itemsQuery.data?.data?.data ?? [],

    receiveStock: receiveMutation.mutateAsync,
    isReceiving: receiveMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-stock-balances'] }),
  }
}
