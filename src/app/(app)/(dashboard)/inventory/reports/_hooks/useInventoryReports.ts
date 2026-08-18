'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { getValuationReport } from '../_actions/get-valuation-report'
import { getTurnoverReport } from '../_actions/get-turnover-report'
import { getAgingReport } from '../_actions/get-aging-report'
import { getReconciliationReport } from '../_actions/get-reconciliation-report'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getCategories } from '../../items/_actions/get-lookup-data'
import type { SerialAgingBucket } from '@/src/schema/inventory/reports'

export type ReportTab = 'valuation' | 'turnover' | 'aging' | 'reconciliation'

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

  // Aging-specific
  const [agingBucketFilter, setAgingBucketFilter] = useState<SerialAgingBucket | undefined>(
    undefined
  )

  // Reconciliation-specific — no pagination (backend caps each section at
  // 50 sample rows server-side), just an optional date range.
  const [reconStartDate, setReconStartDate] = useState<string | undefined>(undefined)
  const [reconEndDate, setReconEndDate] = useState<string | undefined>(undefined)

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

  const agingParams = useMemo(
    () => ({
      warehouseId: warehouseFilter,
      categoryId: categoryFilter,
      search: search || undefined,
      bucket: agingBucketFilter,
      page,
      limit: PAGE_SIZE,
    }),
    [warehouseFilter, categoryFilter, search, agingBucketFilter, page]
  )

  const agingQuery = useQuery({
    queryKey: ['inventory-report-aging', agingParams],
    queryFn: () => getAgingReport(agingParams),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    enabled: tab === 'aging',
  })

  const reconciliationParams = useMemo(
    () => ({ startDate: reconStartDate, endDate: reconEndDate }),
    [reconStartDate, reconEndDate]
  )

  const reconciliationQuery = useQuery({
    queryKey: ['inventory-report-reconciliation', reconciliationParams],
    queryFn: () => getReconciliationReport(reconciliationParams),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    enabled: tab === 'reconciliation',
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
      setAgingBucketFilter(undefined)
      setReconStartDate(undefined)
      setReconEndDate(undefined)
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

    // Aging
    agingBucketFilter,
    setAgingBucketFilter: (v: SerialAgingBucket | undefined) => {
      setAgingBucketFilter(v)
      resetPage()
    },
    agingData: agingQuery.data?.data,
    isAgingLoading: agingQuery.isLoading,
    isAgingFetching: agingQuery.isFetching,
    agingError: agingQuery.error,
    refetchAging: () => agingQuery.refetch(),

    // Reconciliation
    reconStartDate,
    reconEndDate,
    setReconStartDate,
    setReconEndDate,
    reconciliationData: reconciliationQuery.data?.data,
    isReconciliationLoading: reconciliationQuery.isLoading,
    isReconciliationFetching: reconciliationQuery.isFetching,
    reconciliationError: reconciliationQuery.error,
    refetchReconciliation: () => reconciliationQuery.refetch(),

    warehouseOptions: warehousesQuery.data?.data?.data ?? [],
    categoryOptions: categoriesQuery.data?.data?.data ?? [],
  }
}
