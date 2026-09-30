'use client'

import { useMemo, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { listEmployees } from '../_actions/list-employees'

export function useEmployees() {
  const [search, setSearch] = useState('')

  const queryParams = useMemo(() => ({ search: search || undefined }), [search])

  const listQuery = useQuery({
    queryKey: ['accounting-employees', queryParams],
    queryFn: () => listEmployees(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  })

  const employees = listQuery.data?.data?.items ?? []

  return {
    employees,
    total: listQuery.data?.data?.total ?? 0,
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    error: listQuery.error,
    search,
    setSearch,
  }
}
