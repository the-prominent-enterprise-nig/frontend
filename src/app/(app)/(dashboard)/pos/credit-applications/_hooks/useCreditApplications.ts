'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo, useEffect } from 'react'
import { getCreditApplications } from '../_actions/get-applications'
import type { CreditApplicationStatus } from '@/src/schema/credit/applications'

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

export function useCreditApplications() {
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [statusFilter, setStatusFilter] = useState<CreditApplicationStatus | undefined>(undefined)
  const [search, setSearchState] = useState('')
  // The box updates on every keystroke; only the debounced value reaches the
  // query key, so typing a name doesn't fire a request per character.
  const debouncedSearch = useDebouncedValue(search, 300)

  const queryParams = useMemo(
    () => ({ page, limit, status: statusFilter, search: debouncedSearch.trim() || undefined }),
    [page, limit, statusFilter, debouncedSearch]
  )

  const applicationsQuery = useQuery({
    queryKey: ['credit-applications', queryParams],
    queryFn: () => getCreditApplications(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    // Scenario 26 — this queue is a maker-checker handoff between three
    // different people's browser tabs (Cashier submits, Investigator
    // records, Branch Manager decides); staleTime alone only ever refetches
    // on this tab's own refocus/remount, so another actor's transition
    // could sit stale here indefinitely. Matches
    // ReleaseApprovalsList.tsx's own 10s poll for the same reason.
    refetchInterval: 10 * 1000,
  })

  const applications = applicationsQuery.data?.data?.data ?? []
  const meta = applicationsQuery.data?.data?.meta
  const pagination = {
    total: meta?.total ?? 0,
    page: meta?.page ?? 1,
    limit: meta?.limit ?? limit,
    totalPages: meta?.totalPages ?? 0,
  }

  return {
    applications,
    pagination,
    isLoading: applicationsQuery.isLoading,
    isFetching: applicationsQuery.isFetching,
    error: applicationsQuery.error,

    statusFilter,
    setStatusFilter: (v: CreditApplicationStatus | undefined) => {
      setStatusFilter(v)
      setPage(1)
    },

    search,
    setSearch: (v: string) => {
      setSearchState(v)
      setPage(1)
    },

    page,
    setPage,
  }
}
