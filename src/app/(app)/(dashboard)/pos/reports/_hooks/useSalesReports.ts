'use client'

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { getSalesByBranch, getSalesByBrand } from '../_actions/get-sales-report'
import type { SalesReportResponse } from '@/src/schema/pos/reports'
import type { DateRange } from '@/src/components/common/ReportDateRange'

export type SalesReportTab = 'branch' | 'brand'

/** Summary rows per page. Grouping now reaches model of unit, so a wide date
 * range produces one row per branch x brand x category x model — far more
 * than fits on a screen. */
export const SUMMARY_PAGE_SIZE = 10

function monthToDate(): DateRange {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  const iso = (d: Date): string => new Date(d.getTime() - offset).toISOString().slice(0, 10)
  return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) }
}

export function useSalesReports() {
  const [tab, setTab] = useState<SalesReportTab>('branch')
  const [range, setRange] = useState<DateRange>(monthToDate)
  const [branchId, setBranchId] = useState<string>('')
  const [brandId, setBrandId] = useState<string>('')
  const [page, setPage] = useState(1)

  const params = {
    startDate: range.from || undefined,
    endDate: range.to || undefined,
    branchIds: branchId ? [branchId] : undefined,
    brandIds: brandId ? [brandId] : undefined,
  }

  // Any change to what's being reported invalidates the current page — page 7
  // of the old result set is meaningless against the new one.
  function resetPage<T>(setter: (value: T) => void): (value: T) => void {
    return (value: T) => {
      setPage(1)
      setter(value)
    }
  }

  const query = useQuery({
    queryKey: ['pos-sales-report', tab, params],
    queryFn: async (): Promise<SalesReportResponse | null> => {
      const res = tab === 'branch' ? await getSalesByBranch(params) : await getSalesByBrand(params)
      return res.success && res.data ? res.data : null
    },
    placeholderData: keepPreviousData,
  })

  /** The export endpoint takes the same params the screen was loaded with —
   * that's what keeps the downloaded file and the table in agreement. */
  const exportParams = {
    startDate: params.startDate,
    endDate: params.endDate,
    branchIds: branchId || undefined,
    brandIds: brandId || undefined,
  }

  const summary = query.data?.summary ?? []
  const pageCount = Math.max(1, Math.ceil(summary.length / SUMMARY_PAGE_SIZE))
  // Guard against a stale page surviving a filter change that shrank the result.
  const safePage = Math.min(page, pageCount)
  const pageStart = (safePage - 1) * SUMMARY_PAGE_SIZE

  return {
    tab,
    setTab: resetPage(setTab),
    range,
    setRange: resetPage(setRange),
    branchId,
    setBranchId: resetPage(setBranchId),
    brandId,
    setBrandId: resetPage(setBrandId),
    page: safePage,
    setPage,
    pageCount,
    pageStart,
    pageRows: summary.slice(pageStart, pageStart + SUMMARY_PAGE_SIZE),
    totalRows: summary.length,
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    exportParams,
    exportEndpoint:
      tab === 'branch'
        ? '/pos/reports/sales-by-branch/export'
        : '/pos/reports/sales-by-brand/export',
  }
}
