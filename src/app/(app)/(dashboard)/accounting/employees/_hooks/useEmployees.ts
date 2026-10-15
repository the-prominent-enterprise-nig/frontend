'use client'

import { useMemo, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { employeeQueries } from '../_queries'

export function useEmployees() {
  const [search, setSearch] = useState('')

  const queryParams = useMemo(() => ({ search: search || undefined }), [search])

  // Same options the page prefetched on the server, so the first render already
  // has rows; typing in the search box changes the key and refetches.
  const listQuery = useQuery({
    ...employeeQueries.list(queryParams),
    placeholderData: keepPreviousData,
  })

  const employees = listQuery.data?.items ?? []

  return {
    employees,
    total: listQuery.data?.total ?? 0,
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    error: listQuery.error,
    search,
    setSearch,
  }
}
