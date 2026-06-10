'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { getValuationReport } from '../_actions/get-valuation-report'
import { getTurnoverReport } from '../_actions/get-turnover-report'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'

export type ReportTab = 'valuation' | 'turnover'

export function useInventoryReports() {
  const [tab, setTab] = useState<ReportTab>('valuation')

  // Shared filters
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')

  // Turnover-specific
  const [periodDays, setPeriodDays] = useState<number>(90)
  const [statusFilter, setStatusFilter] = useState<
    'healthy' | 'slow_moving' | 'dead_stock' | undefined
  >(undefined)

  const valuationParams = useMemo(
    () => ({ warehouseId: warehouseFilter, search: search || undefined }),
    [warehouseFilter, search]
  )

  const turnoverParams = useMemo(
    () => ({
      periodDays,
      warehouseId: warehouseFilter,
      search: search || undefined,
      status: statusFilter,
    }),
    [periodDays, warehouseFilter, search, statusFilter]
  )

  const valuationQuery = useQuery({
    queryKey: ['inventory-report-valuation', valuationParams],
    queryFn: () => getValuationReport(valuationParams),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    enabled: tab === 'valuation',
  })

  const turnoverQuery = useQuery({
    queryKey: ['inventory-report-turnover', turnoverParams],
    queryFn: () => getTurnoverReport(turnoverParams),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    enabled: tab === 'turnover',
  })

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  return {
    tab,
    setTab,

    warehouseFilter,
    search,
    setWarehouseFilter: (v: string | undefined) => setWarehouseFilter(v),
    setSearch: (v: string) => setSearch(v),
    resetFilters: () => {
      setWarehouseFilter(undefined)
      setSearch('')
      setStatusFilter(undefined)
    },

    // Valuation
    valuationData: valuationQuery.data?.data,
    isValuationLoading: valuationQuery.isLoading,
    isValuationFetching: valuationQuery.isFetching,
    valuationError: valuationQuery.error,
    refetchValuation: () => valuationQuery.refetch(),

    // Turnover
    periodDays,
    setPeriodDays: (v: number) => setPeriodDays(v),
    statusFilter,
    setStatusFilter: (v: typeof statusFilter) => setStatusFilter(v),
    turnoverData: turnoverQuery.data?.data,
    isTurnoverLoading: turnoverQuery.isLoading,
    isTurnoverFetching: turnoverQuery.isFetching,
    turnoverError: turnoverQuery.error,
    refetchTurnover: () => turnoverQuery.refetch(),

    warehouseOptions: warehousesQuery.data?.data?.data ?? [],
  }
}
