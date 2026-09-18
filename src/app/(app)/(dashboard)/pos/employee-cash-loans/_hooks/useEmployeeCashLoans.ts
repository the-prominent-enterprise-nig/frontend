'use client'

import { useMemo, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { listEmployeeCashLoans } from '../_actions/list-cash-loans'

export function useEmployeeCashLoans() {
  const [search, setSearch] = useState('')

  const queryParams = useMemo(() => ({ search: search || undefined }), [search])

  const listQuery = useQuery({
    queryKey: ['pos-employee-cash-loans', queryParams],
    queryFn: () => listEmployeeCashLoans(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  })

  const loans = listQuery.data?.data?.items ?? []

  return {
    loans,
    total: listQuery.data?.data?.total ?? 0,
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    error: listQuery.error,
    search,
    setSearch,
  }
}
