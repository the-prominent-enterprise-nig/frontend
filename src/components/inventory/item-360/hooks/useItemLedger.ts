'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { STALE } from '@/src/libs/query/stale-times'
import { getItemLedger } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-item-ledger'
import { splitLocationTokens } from '@/src/libs/inventory/location-tokens'

/**
 * @param locations branch:/warehouse: tokens the Item 360 drawer was opened
 * with (see useItem360). Scopes Movements to the same locations as the Stock
 * tab; empty/undefined means every location.
 */
export function useItemLedger(itemId: string, locations?: string[]) {
  const [page, setPage] = useState(1)
  const limit = 20
  const [warehouseId, setWarehouseId] = useState<string | undefined>(undefined)
  const [transactionType, setTransactionType] = useState<string | undefined>(undefined)
  const [startDate, setStartDate] = useState<string | undefined>(undefined)
  const [endDate, setEndDate] = useState<string | undefined>(undefined)

  const { branchIds, warehouseIds } = splitLocationTokens(locations)
  const scopeKey = [...branchIds, ...warehouseIds].sort().join(',')

  const params = useMemo(
    () => ({
      page,
      limit,
      warehouseId,
      transactionType,
      startDate,
      endDate,
      branchIds,
      warehouseIds,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, limit, warehouseId, transactionType, startDate, endDate, scopeKey]
  )

  const ledgerQuery = useQuery({
    queryKey: ['inventory-item-ledger', itemId, params],
    queryFn: () => getItemLedger(itemId, params),
    staleTime: STALE.REALTIME,
    placeholderData: keepPreviousData,
    enabled: !!itemId,
  })

  const ledgerData = ledgerQuery.data?.data

  function setWarehouseIdAndReset(id: string | undefined) {
    setWarehouseId(id)
    setPage(1)
  }

  function setTransactionTypeAndReset(type: string | undefined) {
    setTransactionType(type)
    setPage(1)
  }

  function setStartDateAndReset(date: string | undefined) {
    setStartDate(date)
    setPage(1)
  }

  function setEndDateAndReset(date: string | undefined) {
    setEndDate(date)
    setPage(1)
  }

  function resetFilters() {
    setWarehouseId(undefined)
    setTransactionType(undefined)
    setStartDate(undefined)
    setEndDate(undefined)
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
    startDate,
    setStartDate: setStartDateAndReset,
    endDate,
    setEndDate: setEndDateAndReset,
    resetFilters,
  }
}
