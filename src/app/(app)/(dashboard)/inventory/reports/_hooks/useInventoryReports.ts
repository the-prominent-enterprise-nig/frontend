'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { getValuationReport } from '../_actions/get-valuation-report'
import { getTurnoverReport } from '../_actions/get-turnover-report'
import { getAgingReport } from '../_actions/get-aging-report'
import { getReconciliationReport } from '../_actions/get-reconciliation-report'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getCategories, getItemTypes } from '../../items/_actions/get-lookup-data'
import type { SerialAgingBucket, UnitClassification } from '@/src/schema/inventory/reports'
import type { CategoryOption } from '@/src/schema/inventory/items'

export type ReportTab = 'valuation' | 'turnover' | 'aging' | 'reconciliation'

/** The aging report's filters, as last processed. On screen `typeId` is the
 * Type (item type) and `categoryId` the Category (a root matches its subgroups). */
export interface AgingFilters {
  asOf: string
  warehouseId?: string
  categoryId?: string
  typeId?: string
  classification?: UnitClassification
}

/** Today as YYYY-MM-DD in the viewer's own timezone. */
function todayIso(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60 * 1000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

const PAGE_SIZE = 20

/** Roots by name, subgroups as "Root › Subgroup", sorted so each root sits
 * just above its own subgroups. */
function withSubgroupLabels(categories: CategoryOption[]): { id: string; name: string }[] {
  const nameById = new Map(categories.map((c) => [c.id, c.name]))
  return categories
    .map((c) => {
      const parent = c.parentCategoryId ? nameById.get(c.parentCategoryId) : undefined
      return { id: c.id, name: parent ? `${parent} › ${c.name}` : c.name }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The aging report's Category options: every category (roots and their
 * subgroups, ≈400, so past the lookup's default 200), narrowed to those
 * holding items of the chosen Type (item type) when one is picked.
 */
export function useAgingCategoryOptions(typeId?: string): { id: string; name: string }[] {
  const query = useQuery({
    queryKey: ['inventory-categories-by-type-lookup', typeId ?? 'all'],
    queryFn: () => getCategories({ limit: 1000, typeId }),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
  return useMemo(() => withSubgroupLabels(query.data?.data?.data ?? []), [query.data])
}

export function useInventoryReports() {
  const [tab, setTab] = useState<ReportTab>('aging')

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
  const [agingAsOf, setAgingAsOf] = useState<string>(todayIso)
  const [agingTypeId, setAgingTypeId] = useState<string | undefined>(undefined)
  const [agingClassification, setAgingClassification] = useState<UnitClassification | undefined>(
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
      typeId: agingTypeId,
      classification: agingClassification,
      asOf: agingAsOf,
      page,
      limit: PAGE_SIZE,
    }),
    [
      warehouseFilter,
      categoryFilter,
      search,
      agingBucketFilter,
      agingTypeId,
      agingClassification,
      agingAsOf,
      page,
    ]
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

  const typesQuery = useQuery({
    queryKey: ['inventory-item-types-lookup'],
    queryFn: () => getItemTypes(),
    staleTime: 5 * 60 * 1000,
    enabled: tab === 'aging',
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
      setAgingAsOf(todayIso())
      setAgingTypeId(undefined)
      setAgingClassification(undefined)
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
    agingFilters: {
      asOf: agingAsOf,
      warehouseId: warehouseFilter,
      categoryId: categoryFilter,
      typeId: agingTypeId,
      classification: agingClassification,
    } satisfies AgingFilters,
    applyAgingFilters: (next: AgingFilters) => {
      setAgingAsOf(next.asOf || todayIso())
      setWarehouseFilter(next.warehouseId)
      setCategoryFilter(next.categoryId)
      setAgingTypeId(next.typeId)
      setAgingClassification(next.classification)
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
    typeOptions: typesQuery.data?.data ?? [],
  }
}
