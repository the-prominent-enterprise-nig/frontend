'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { getSuppliers } from '../_actions/get-supplier-list'

interface UseSupplierListParams {
  initialPage?: number
  initialLimit?: number
  initialSearch?: string
  initialStatus?: string
  initialOnboarding?: string
}

export function useSupplierList(params: UseSupplierListParams = {}) {
  const {
    initialPage = 1,
    initialLimit = 10,
    initialSearch = '',
    initialStatus = 'all',
    initialOnboarding = 'all',
  } = params

  const [page, setPage] = useState(initialPage)
  const [limit, setLimit] = useState(initialLimit)
  const [search, setSearch] = useState(initialSearch)
  const [status, setStatus] = useState(initialStatus)
  const [onboardingStatus, setOnboardingStatus] = useState(initialOnboarding)

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      search: search || undefined,
      status: status !== 'all' ? status : undefined,
      onboardingStatus: onboardingStatus !== 'all' ? onboardingStatus : undefined,
    }),
    [page, limit, search, status, onboardingStatus]
  )

  const { data, isLoading, isFetching, isPlaceholderData, error, refetch } = useQuery({
    queryKey: ['suppliers', queryParams],
    queryFn: () => getSuppliers(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  })

  const suppliers = data?.data?.data || []
  const meta = data?.data?.meta || { total: 0, page: 1, limit, lastPage: 1 }

  const pagination = {
    currentPage: page,
    totalPages: meta.lastPage,
    totalItems: meta.total,
    itemsPerPage: limit,
    from: meta.total === 0 ? 0 : (page - 1) * limit + 1,
    to: Math.min(page * limit, meta.total),
    hasNextPage: page < meta.lastPage,
    hasPreviousPage: page > 1,
  }

  const goToPage = (n: number) => {
    if (n >= 1 && n <= meta.lastPage && !isPlaceholderData) setPage(n)
  }
  const nextPage = () => pagination.hasNextPage && setPage((p) => p + 1)
  const previousPage = () => pagination.hasPreviousPage && setPage((p) => p - 1)

  const setSearchQuery = (q: string) => {
    setSearch(q)
    setPage(1)
  }
  const setStatusFilter = (v: string) => {
    setStatus(v)
    setPage(1)
  }
  const setOnboardingFilter = (v: string) => {
    setOnboardingStatus(v)
    setPage(1)
  }
  const clearFilters = () => {
    setSearch('')
    setStatus('all')
    setOnboardingStatus('all')
    setPage(1)
  }

  const hasActiveFilters = search !== '' || status !== 'all' || onboardingStatus !== 'all'

  const getPageNumbers = () => {
    const max = 5
    const total = meta.lastPage
    if (total <= max) return Array.from({ length: total }, (_, i) => i + 1)
    if (page <= 3) return [1, 2, 3, 4, 5]
    if (page >= total - 2) return [total - 4, total - 3, total - 2, total - 1, total]
    return [page - 2, page - 1, page, page + 1, page + 2]
  }

  return {
    suppliers,
    meta,
    pagination,
    isLoading,
    isFetching,
    isPlaceholderData,
    error,
    filters: { search, status, onboardingStatus },
    setSearch: setSearchQuery,
    setStatus: setStatusFilter,
    setOnboardingStatus: setOnboardingFilter,
    setItemsPerPage: (n: number) => {
      setLimit(n)
      setPage(1)
    },
    clearFilters,
    hasActiveFilters,
    goToPage,
    nextPage,
    previousPage,
    getPageNumbers,
    refetch,
  }
}
