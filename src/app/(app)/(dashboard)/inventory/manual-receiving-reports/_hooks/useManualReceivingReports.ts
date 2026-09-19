'use client'

import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { getManualReceivingReports } from '../_actions/get-manual-receiving-reports'
import type { ManualReceivingReportStatus } from '@/src/schema/inventory/manual-receiving-reports'

// Scenario 53 — trimmed down to just listing/filtering: the create, detail
// and post flows now call their server actions directly from their own
// routed pages (ManualRrForm.tsx / ManualRrDetail.tsx), not through this
// hook. Its only remaining consumer is ManualRrPanel.tsx's draft list.
export function useManualReceivingReports() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<ManualReceivingReportStatus | undefined>(
    undefined
  )

  const queryParams = useMemo(
    () => ({ page, limit, warehouseId: warehouseFilter, status: statusFilter }),
    [page, limit, warehouseFilter, statusFilter]
  )

  const reportsQuery = useQuery({
    queryKey: ['inventory-manual-receiving-reports', queryParams],
    queryFn: () => getManualReceivingReports(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    // Same rationale as useAdjustments.ts — a draft can be posted from a
    // different browser tab, and there's no notification wired for this
    // feature to otherwise prompt a refetch.
    refetchInterval: 10 * 1000,
  })

  const reports = reportsQuery.data?.data?.data ?? []
  const meta = reportsQuery.data?.data?.meta
  const pagination = {
    total: meta?.total ?? 0,
    page: meta?.page ?? 1,
    limit: meta?.limit ?? limit,
    totalPages: meta?.lastPage ?? 0,
  }

  return {
    reports,
    pagination,
    isLoading: reportsQuery.isLoading,
    isFetching: reportsQuery.isFetching,
    error: reportsQuery.error,

    warehouseFilter,
    statusFilter,
    setWarehouseFilter: (v: string | undefined) => {
      setWarehouseFilter(v)
      setPage(1)
    },
    setStatusFilter: (v: ManualReceivingReportStatus | undefined) => {
      setStatusFilter(v)
      setPage(1)
    },
    resetFilters: () => {
      setWarehouseFilter(undefined)
      setStatusFilter(undefined)
      setPage(1)
    },

    page,
    setPage,

    refetch: () =>
      queryClient.invalidateQueries({ queryKey: ['inventory-manual-receiving-reports'] }),
  }
}
