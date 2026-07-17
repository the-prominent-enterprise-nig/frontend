'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { getValuationReport } from '../_actions/get-valuation-report'
import { getTurnoverReport } from '../_actions/get-turnover-report'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getCategories } from '../../items/_actions/get-lookup-data'

export type ReportTab = 'valuation' | 'turnover'

const PAGE_SIZE = 20

export function useInventoryReports() {
  const [tab, setTab] = useState<ReportTab>('valuation')

  // Shared filters
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>(undefined)
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Turnover-specific
  const [periodDays, setPeriodDays] = useState<number>(90)
  const [statusFilter, setStatusFilter] = useState<
    'healthy' | 'slow_moving' | 'dead_stock' | undefined
  >(undefined)

  function resetPage(): void {
    setPage(1)
  }

  const valuationParams = useMemo(
    () => ({
      warehouseId: warehouseFilter,
      categoryId: categoryFilter,
      search: search || undefined,
      page,
      limit: PAGE_SIZE,
    }),
    [warehouseFilter, categoryFilter, search, page]
  )

  const turnoverParams = useMemo(
    () => ({
      periodDays,
      warehouseId: warehouseFilter,
      categoryId: categoryFilter,
      search: search || undefined,
      status: statusFilter,
      page,
      limit: PAGE_SIZE,
    }),
    [periodDays, warehouseFilter, categoryFilter, search, statusFilter, page]
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

  const categoriesQuery = useQuery({
    queryKey: ['inventory-categories-lookup'],
    queryFn: () => getCategories(),
    staleTime: 5 * 60 * 1000,
  })

  return {
    tab,
    setTab: (v: ReportTab) => {
      setTab(v)
      resetPage()
    },

    warehouseFilter,
    categoryFilter,
    search,
    setWarehouseFilter: (v: string | undefined) => {
      setWarehouseFilter(v)
      resetPage()
    },
    setCategoryFilter: (v: string | undefined) => {
      setCategoryFilter(v)
      resetPage()
    },
    setSearch: (v: string) => {
      setSearch(v)
      resetPage()
    },
    resetFilters: () => {
      setWarehouseFilter(undefined)
      setCategoryFilter(undefined)
      setSearch('')
      setStatusFilter(undefined)
      resetPage()
    },

    page,
    setPage,

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
    setStatusFilter: (v: typeof statusFilter) => {
      setStatusFilter(v)
      resetPage()
    },
    turnoverData: turnoverQuery.data?.data,
    isTurnoverLoading: turnoverQuery.isLoading,
    isTurnoverFetching: turnoverQuery.isFetching,
    turnoverError: turnoverQuery.error,
    refetchTurnover: () => turnoverQuery.refetch(),

    warehouseOptions: warehousesQuery.data?.data?.data ?? [],
    categoryOptions: categoriesQuery.data?.data?.data ?? [],
  }
}
