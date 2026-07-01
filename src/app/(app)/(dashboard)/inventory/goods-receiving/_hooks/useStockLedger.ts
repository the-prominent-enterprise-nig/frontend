'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { STALE } from '@/src/libs/query/stale-times'
import { getStockLedger } from '../_actions/get-stock-ledger'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'

export function useStockLedger() {
  const [page, setPage] = useState(1)
  const limit = 25

  const [warehouseId, setWarehouseId] = useState<string | undefined>()
  const [branchId, setBranchId] = useState<string | undefined>()
  const [transactionType, setTransactionType] = useState<string | undefined>()
  const [startDate, setStartDate] = useState<string | undefined>()
  const [endDate, setEndDate] = useState<string | undefined>()

  const params = useMemo(
    () => ({ page, limit, warehouseId, branchId, transactionType, startDate, endDate }),
    [page, limit, warehouseId, branchId, transactionType, startDate, endDate]
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

  const entries = ledgerQuery.data?.data?.data ?? []
  const total = ledgerQuery.data?.data?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  function resetFilters() {
    setWarehouseId(undefined)
    setBranchId(undefined)
    setTransactionType(undefined)
    setStartDate(undefined)
    setEndDate(undefined)
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

    warehouseId,
    branchId,
    transactionType,
    startDate,
    endDate,
    setWarehouseId: (v: string | undefined) => {
      setWarehouseId(v)
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

    warehouseOptions: warehousesQuery.data?.data?.data ?? [],
  }
}
