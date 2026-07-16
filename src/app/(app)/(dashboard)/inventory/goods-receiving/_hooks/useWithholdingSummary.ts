'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { STALE } from '@/src/libs/query/stale-times'
import { getWithholdingSummary } from '../_actions/get-withholding-summary'

export function useWithholdingSummary() {
  const [page, setPage] = useState(1)
  const limit = 20

  const [supplierId, setSupplierId] = useState<string | undefined>()
  const [startDate, setStartDate] = useState<string | undefined>()
  const [endDate, setEndDate] = useState<string | undefined>()

  const params = useMemo(
    () => ({ page, limit, supplierId, startDate, endDate }),
    [page, limit, supplierId, startDate, endDate]
  )

  const query = useQuery({
    queryKey: ['inventory-withholding-summary', params],
    queryFn: () => getWithholdingSummary(params),
    placeholderData: keepPreviousData,
    staleTime: STALE.REALTIME,
  })

  const rows = query.data?.data?.data ?? []
  const meta = query.data?.data?.meta
  const totalPages = meta ? meta.lastPage : 1

  function resetFilters() {
    setSupplierId(undefined)
    setStartDate(undefined)
    setEndDate(undefined)
    setPage(1)
  }

  return {
    rows,
    meta,
    page,
    limit,
    totalPages,
    isLoading: query.isLoading,
    isFetching: query.isFetching,

    supplierId,
    startDate,
    endDate,
    setSupplierId: (v: string | undefined) => {
      setSupplierId(v)
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
  }
}
