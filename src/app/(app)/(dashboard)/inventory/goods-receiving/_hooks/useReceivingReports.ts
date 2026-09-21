'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { STALE } from '@/src/libs/query/stale-times'
import { getReceivingReports } from '../_actions/get-receiving-reports'
import { getReceivingReport } from '../_actions/get-receiving-report'
import { getReceivingReportsSummary } from '../_actions/get-receiving-reports-summary'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getSuppliers } from '../../purchase-orders/_actions/get-suppliers'

export function useReceivingReports(options: { includeManual?: boolean } = {}) {
  const { includeManual = false } = options
  const [page, setPage] = useState(1)
  const limit = 20

  const [search, setSearchState] = useState('')
  const [warehouseId, setWarehouseId] = useState<string | undefined>()
  const [supplierId, setSupplierId] = useState<string | undefined>()
  const [status, setStatus] = useState<string | undefined>()
  const [hasDiscrepancy, setHasDiscrepancy] = useState<boolean | undefined>()
  const [startDate, setStartDate] = useState<string | undefined>()
  const [endDate, setEndDate] = useState<string | undefined>()
  const [selectedId, setSelectedId] = useState<string | undefined>()

  const params = useMemo(
    () => ({
      page,
      limit,
      warehouseId,
      supplierId,
      status,
      search: search || undefined,
      hasDiscrepancy,
      startDate,
      endDate,
      includeManual,
    }),
    [
      page,
      limit,
      warehouseId,
      supplierId,
      status,
      search,
      hasDiscrepancy,
      startDate,
      endDate,
      includeManual,
    ]
  )

  const listQuery = useQuery({
    queryKey: ['inventory-receiving-reports', params],
    queryFn: () => getReceivingReports(params),
    placeholderData: keepPreviousData,
    staleTime: STALE.REALTIME,
  })

  const detailQuery = useQuery({
    queryKey: ['inventory-receiving-report', selectedId],
    queryFn: () => getReceivingReport(selectedId!),
    enabled: !!selectedId,
    staleTime: STALE.REALTIME,
  })

  // Header KPI row — a tenant-wide snapshot, not scoped to the filters
  // above, so it doesn't need to be in `params` or refetch per keystroke.
  const summaryQuery = useQuery({
    queryKey: ['inventory-receiving-reports-summary'],
    queryFn: () => getReceivingReportsSummary(),
    staleTime: 60 * 1000,
  })

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  const suppliersQuery = useQuery({
    queryKey: ['inventory-suppliers-lookup'],
    queryFn: () => getSuppliers({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  })

  const reports = listQuery.data?.data?.data ?? []
  const meta = listQuery.data?.data?.meta
  const totalPages = meta ? meta.lastPage : 1

  function resetFilters() {
    setSearchState('')
    setWarehouseId(undefined)
    setSupplierId(undefined)
    setStatus(undefined)
    setHasDiscrepancy(undefined)
    setStartDate(undefined)
    setEndDate(undefined)
    setPage(1)
  }

  return {
    reports,
    meta,
    page,
    limit,
    totalPages,
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    refetch: listQuery.refetch,

    summary: summaryQuery.data?.data,
    isLoadingSummary: summaryQuery.isLoading,

    warehouseOptions: warehousesQuery.data?.data?.data ?? [],
    warehousesLoading: warehousesQuery.isLoading,
    supplierOptions: suppliersQuery.data?.data?.data ?? [],
    suppliersLoading: suppliersQuery.isLoading,

    search,
    warehouseId,
    supplierId,
    status,
    hasDiscrepancy,
    startDate,
    endDate,
    setSearch: (v: string) => {
      setSearchState(v)
      setPage(1)
    },
    setWarehouseId: (v: string | undefined) => {
      setWarehouseId(v)
      setPage(1)
    },
    setSupplierId: (v: string | undefined) => {
      setSupplierId(v)
      setPage(1)
    },
    setStatus: (v: string | undefined) => {
      setStatus(v)
      setPage(1)
    },
    setHasDiscrepancy: (v: boolean | undefined) => {
      setHasDiscrepancy(v)
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

    selectedId,
    setSelectedId,
    selectedReport: detailQuery.data?.data ?? null,
    isLoadingDetail: detailQuery.isLoading,
    // getReceivingReport() resolves (doesn't throw) even on a backend
    // error — it returns { success: false, message }. Surface that so the
    // UI can show *something* instead of silently rendering nothing when
    // a receipt fails to load.
    detailError:
      detailQuery.data && detailQuery.data.success === false
        ? (detailQuery.data.message ?? detailQuery.data.error ?? 'Failed to load this receipt.')
        : null,
  }
}
