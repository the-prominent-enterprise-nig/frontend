'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { STALE } from '@/src/libs/query/stale-times'
import { getReceivingReports } from '../_actions/get-receiving-reports'
import { getReceivingReport } from '../_actions/get-receiving-report'

export function useReceivingReports() {
  const [page, setPage] = useState(1)
  const limit = 20

  const [warehouseId, setWarehouseId] = useState<string | undefined>()
  const [hasDiscrepancy, setHasDiscrepancy] = useState<boolean | undefined>()
  const [startDate, setStartDate] = useState<string | undefined>()
  const [endDate, setEndDate] = useState<string | undefined>()
  const [selectedId, setSelectedId] = useState<string | undefined>()

  const params = useMemo(
    () => ({ page, limit, warehouseId, hasDiscrepancy, startDate, endDate }),
    [page, limit, warehouseId, hasDiscrepancy, startDate, endDate]
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

  const reports = listQuery.data?.data?.data ?? []
  const meta = listQuery.data?.data?.meta
  const totalPages = meta ? meta.lastPage : 1

  function resetFilters() {
    setWarehouseId(undefined)
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

    warehouseId,
    hasDiscrepancy,
    startDate,
    endDate,
    setWarehouseId: (v: string | undefined) => {
      setWarehouseId(v)
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
  }
}
