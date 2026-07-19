'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { STALE } from '@/src/libs/query/stale-times'
import { getItemLedger } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-item-ledger'
import { getWarehouses } from '@/src/app/(app)/(dashboard)/inventory/warehouses/_actions/get-warehouses'

export function useItemLedger(itemId: string) {
  const [page, setPage] = useState(1)
  const limit = 20
  const [warehouseId, setWarehouseId] = useState<string | undefined>(undefined)
  const [transactionType, setTransactionType] = useState<string | undefined>(undefined)

  const params = useMemo(
    () => ({ page, limit, warehouseId, transactionType }),
    [page, limit, warehouseId, transactionType]
  )

  const ledgerQuery = useQuery({
    queryKey: ['inventory-item-ledger', itemId, params],
    queryFn: () => getItemLedger(itemId, params),
    staleTime: STALE.REALTIME,
    placeholderData: keepPreviousData,
    enabled: !!itemId,
  })

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 100, status: 'active' }),
    staleTime: STALE.LOOKUP,
  })

  const warehouseOptions = useMemo(() => {
    const warehouses = warehousesQuery.data?.data?.data ?? []
    return warehouses.map((w) => ({ label: w.name, value: w.id }))
  }, [warehousesQuery.data])

  const ledgerData = ledgerQuery.data?.data

  function setWarehouseIdAndReset(id: string | undefined) {
    setWarehouseId(id)
    setPage(1)
  }

  function setTransactionTypeAndReset(type: string | undefined) {
    setTransactionType(type)
    setPage(1)
  }

  function resetFilters() {
    setWarehouseId(undefined)
    setTransactionType(undefined)
    setPage(1)
  }

  return {
    item: ledgerData?.item,
    currentBalances: ledgerData?.currentBalances ?? [],
    openingBalance: ledgerData?.openingBalance ?? 0,
    entries: ledgerData?.data ?? [],
    meta: ledgerData?.meta,
    isLoading: ledgerQuery.isLoading,
    isFetching: ledgerQuery.isFetching,
    page,
    setPage,
    warehouseId,
    setWarehouseId: setWarehouseIdAndReset,
    transactionType,
    setTransactionType: setTransactionTypeAndReset,
    warehouseOptions,
    resetFilters,
  }
}
