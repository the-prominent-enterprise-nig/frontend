'use client'

import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import { useState, useMemo, useEffect } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { STALE } from '@/src/libs/query/stale-times'
import { getReturns, type ReturnOutcome } from '../_actions/get-returns'
import { createCustomerReturn } from '../_actions/create-customer-return'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { locationLabel } from '@/src/libs/format/locationLabel'
import { OUTCOME_ORDER } from '../_components/list/returnDisplay'
import type { CustomerReturnFormValues } from '@/src/schema/inventory/returns'

/** What the date filter is set to, rather than the pair of dates behind it. */
export type DateRange = 'all' | 'last7' | 'last30' | 'custom'

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/** The two dates a preset stands for. `custom` keeps whatever was typed. */
function rangeDates(range: DateRange): { from?: string; to?: string } | null {
  if (range === 'all') return { from: undefined, to: undefined }
  if (range === 'last7') return { from: isoDaysAgo(7), to: undefined }
  if (range === 'last30') return { from: isoDaysAgo(30), to: undefined }
  return null
}

export function useReturnsManager() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>(undefined)
  const [fromDate, setFromDate] = useState<string | undefined>(undefined)
  const [toDate, setToDate] = useState<string | undefined>(undefined)
  const [outcome, setOutcome] = useState<ReturnOutcome | undefined>(undefined)
  const [dateRange, setDateRangeState] = useState<DateRange>('all')

  // Two pieces of state for one box: what is on screen, and what has been
  // asked for. Querying the raw value would fire a request per keystroke,
  // and each one fans out across three tables server-side.
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      warehouseId: warehouseFilter,
      startDate: fromDate,
      endDate: toDate,
      search: debouncedSearch || undefined,
      outcome,
    }),
    [page, limit, warehouseFilter, fromDate, toDate, debouncedSearch, outcome]
  )

  const returnsQuery = useQuery({
    queryKey: ['inventory-returns', queryParams],
    queryFn: () => getReturns(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  /**
   * How many returns of each shape match everything except the shape itself.
   *
   * Counted on the server, not off `returns`: the list is a page of twenty,
   * so counting the rows on screen would have the band reporting how many of
   * the current twenty were repairs — a number that changes when you page and
   * means nothing when you do. An outcome-filtered query skips the two arms
   * it cannot produce rows from, so the three of these together cost about
   * what the unfiltered list query costs on its own.
   */
  const countParams = useMemo(
    () => ({
      warehouseId: warehouseFilter,
      startDate: fromDate,
      endDate: toDate,
      search: debouncedSearch || undefined,
    }),
    [warehouseFilter, fromDate, toDate, debouncedSearch]
  )

  const countQueries = useQueries({
    queries: OUTCOME_ORDER.map((o) => ({
      queryKey: ['inventory-returns-count', o, countParams],
      queryFn: () => getReturns({ ...countParams, outcome: o, page: 1, limit: 1 }),
      staleTime: STALE.OPERATIONAL,
    })),
  })

  const outcomeCounts: Partial<Record<ReturnOutcome, number>> = {}
  OUTCOME_ORDER.forEach((o, i) => {
    const total = countQueries[i]?.data?.data?.total
    if (typeof total === 'number') outcomeCounts[o] = total
  })

  const createMutation = useMutation({
    mutationFn: (data: CustomerReturnFormValues) => createCustomerReturn(data),
    onSuccess: (result) => {
      if (!result.success) {
        showToast({
          title: 'Could not record the return',
          description: result.message,
          status: 'error',
        })
        return
      }

      // A null credit memo is NOT a failure. A cash return, or one against an
      // already-settled invoice, posts correctly — the stock is on the shelf
      // and its cost reversal is in the ledger either way. What is worth
      // saying out loud is when a credit was expected and did not happen,
      // which is exactly when accountingNote is set alongside an invoice.
      const note = result.data?.accountingNote
      const creditWasExpected = !!result.data?.arInvoiceId && !result.data?.creditMemoId

      showToast({
        title: creditWasExpected
          ? 'Return posted — the credit did not go through'
          : 'Return posted',
        description: result.message,
        status: creditWasExpected && note ? 'warning' : 'success',
      })

      queryClient.invalidateQueries({ queryKey: ['inventory-returns'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-stock-balances'] })
    },
  })

  const returns = returnsQuery.data?.data?.data ?? []
  const total = returnsQuery.data?.data?.total ?? 0
  const pagination = {
    total,
    page: returnsQuery.data?.data?.page ?? 1,
    limit: returnsQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil(total / limit),
  }

  // Sorted on the label people actually read, not on the stored warehouse
  // name — "Bago Warehouse" and the branch "Bago" sort to different places,
  // and the picker shows the latter.
  const warehouseOptions = useMemo(() => {
    const rows = warehousesQuery.data?.data?.data ?? []
    return [...rows].sort((a, b) => locationLabel(a, '').localeCompare(locationLabel(b, '')))
  }, [warehousesQuery.data])

  return {
    returns,
    pagination,
    isLoading: returnsQuery.isLoading,
    isFetching: returnsQuery.isFetching,
    error: returnsQuery.error,

    outcomeCounts,

    warehouseFilter,
    fromDate,
    toDate,
    dateRange,
    search,
    outcome,
    setWarehouseFilter: (v: string | undefined) => {
      setWarehouseFilter(v)
      setPage(1)
    },
    setFromDate: (v: string | undefined) => {
      setFromDate(v)
      setPage(1)
    },
    setToDate: (v: string | undefined) => {
      setToDate(v)
      setPage(1)
    },
    // The preset is the thing on screen, so it owns the pair behind it —
    // except on 'custom', which is the preset that means "leave them alone".
    setDateRange: (v: DateRange) => {
      setDateRangeState(v)
      const dates = rangeDates(v)
      if (dates) {
        setFromDate(dates.from)
        setToDate(dates.to)
      }
      setPage(1)
    },
    // Paging resets as the box is typed in, not when the debounce settles:
    // it is the same keystroke either way, and doing it in an effect meant a
    // second render pass chasing the first.
    setSearch: (v: string) => {
      setSearch(v)
      setPage(1)
    },
    setOutcome: (v: ReturnOutcome | undefined) => {
      setOutcome(v)
      setPage(1)
    },
    resetFilters: () => {
      setWarehouseFilter(undefined)
      setFromDate(undefined)
      setToDate(undefined)
      setDateRangeState('all')
      setOutcome(undefined)
      setSearch('')
      setDebouncedSearch('')
      setPage(1)
    },

    page,
    setPage,

    warehouseOptions,

    createReturn: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-returns'] }),
  }
}
