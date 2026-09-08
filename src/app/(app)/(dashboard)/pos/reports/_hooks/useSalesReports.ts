'use client'

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { getSalesByBranch, getSalesByBrand } from '../_actions/get-sales-report'
import type { SalesReportResponse } from '@/src/schema/pos/reports'
import type { DateRange } from '@/src/components/common/ReportDateRange'

export type SalesReportTab = 'branch' | 'brand'

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

  const params = {
    startDate: range.from || undefined,
    endDate: range.to || undefined,
    branchIds: branchId ? [branchId] : undefined,
    brandIds: brandId ? [brandId] : undefined,
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

  return {
    tab,
    setTab,
    range,
    setRange,
    branchId,
    setBranchId,
    brandId,
    setBrandId,
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
