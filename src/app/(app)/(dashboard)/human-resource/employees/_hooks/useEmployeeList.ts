'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { getEmployees } from '../_actions/get-employee-list'
import { fetchOrgRelations } from '../_actions/fetch-org-relations'

interface UseEmployeeListParams {
  initialPage?: number
  initialLimit?: number
  initialSearch?: string
  initialStatus?: string
  initialDepartmentId?: string
  initialBranchId?: string
}

/**
 * Comprehensive hook for employee list with built-in pagination handling
 *
 * Features:
 * - Automatic pagination state management
 * - Search and filter handling
 * - Smooth page transitions (keepPreviousData)
 * - Automatic cache management
 * - Reset to page 1 when filters change
 *
 * @example
 * const {
 *   employees,
 *   pagination,
 *   isLoading,
 *   setPage,
 *   setSearch,
 *   setFilters
 * } = useEmployeeList();
 */
export function useEmployeeList(params: UseEmployeeListParams = {}) {
  const {
    initialPage = 1,
    initialLimit = 10,
    initialSearch = '',
    initialStatus = 'all',
    initialDepartmentId = '',
    initialBranchId = '',
  } = params

  // Pagination & Filter State
  const [page, setPage] = useState(initialPage)
  const [limit, setLimit] = useState(initialLimit)
  const [search, setSearch] = useState(initialSearch)
  const [status, setStatus] = useState(initialStatus)
  const [departmentId, setDepartmentId] = useState(initialDepartmentId)
  const [branchId, setBranchId] = useState(initialBranchId)

  // Build query params
  const queryParams = useMemo(
    () => ({
      page,
      limit,
      search: search || undefined,
      status: status !== 'all' ? status : undefined,
      departmentId: departmentId || undefined,
      branchId: branchId || undefined,
    }),
    [page, limit, search, status, departmentId, branchId]
  )

  // Fetch employees with TanStack Query
  const { data, isLoading, isFetching, isPlaceholderData, error, refetch } = useQuery({
    queryKey: ['employees', queryParams],
    queryFn: () => getEmployees(queryParams),
    placeholderData: keepPreviousData, // Smooth pagination transitions
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  })

  const { data: orgRelationsData } = useQuery({
    queryKey: ['employee-org-relations'],
    queryFn: () => fetchOrgRelations(),
    staleTime: 10 * 60 * 1000,
    retry: 2,
  })

  // Extract data safely
  const employees = data?.data?.data || []
  const departments = orgRelationsData?.departments || []
  const branches = orgRelationsData?.branches || []
  const meta = data?.data?.meta || {
    total: 0,
    page: 1,
    limit: 10,
    lastPage: 1,
  }

  // Pagination info
  const pagination = {
    currentPage: page,
    totalPages: meta.lastPage,
    totalItems: meta.total,
    itemsPerPage: limit,
    from: (page - 1) * limit + 1,
    to: Math.min(page * limit, meta.total),
    hasNextPage: page < meta.lastPage,
    hasPreviousPage: page > 1,
  }

  // Pagination controls
  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= meta.lastPage && !isPlaceholderData) {
      setPage(newPage)
    }
  }

  const nextPage = () => {
    if (pagination.hasNextPage && !isPlaceholderData) {
      setPage((p) => p + 1)
    }
  }

  const previousPage = () => {
    if (pagination.hasPreviousPage && !isPlaceholderData) {
      setPage((p) => p - 1)
    }
  }

  const goToFirstPage = () => {
    if (page !== 1 && !isPlaceholderData) {
      setPage(1)
    }
  }

  const goToLastPage = () => {
    if (page !== meta.lastPage && !isPlaceholderData) {
      setPage(meta.lastPage)
    }
  }

  // Filter controls with auto-reset to page 1
  const setSearchQuery = (query: string) => {
    setSearch(query)
    setPage(1) // Reset to first page when searching
  }

  const setStatusFilter = (newStatus: string) => {
    setStatus(newStatus)
    setPage(1) // Reset to first page when filtering
  }

  const setDepartmentFilter = (deptId: string) => {
    setDepartmentId(deptId)
    setPage(1) // Reset to first page when filtering
  }

  const setBranchFilter = (brId: string) => {
    setBranchId(brId)
    setPage(1) // Reset to first page when filtering
  }

  // Set multiple filters at once
  const setFilters = (filters: {
    status?: string
    departmentId?: string
    branchId?: string
    search?: string
  }) => {
    if (filters.status !== undefined) setStatus(filters.status)
    if (filters.departmentId !== undefined) setDepartmentId(filters.departmentId)
    if (filters.branchId !== undefined) setBranchId(filters.branchId)
    if (filters.search !== undefined) setSearch(filters.search)
    setPage(1) // Reset to first page when any filter changes
  }

  // Clear all filters
  const clearFilters = () => {
    setSearch('')
    setStatus('all')
    setDepartmentId('')
    setBranchId('')
    setPage(1)
  }

  // Check if any filters are active
  const hasActiveFilters =
    search !== '' || status !== 'all' || departmentId !== '' || branchId !== ''

  // Change items per page
  const setItemsPerPage = (newLimit: number) => {
    setLimit(newLimit)
    setPage(1) // Reset to first page when changing limit
  }

  // Get page numbers for pagination UI (max 5 buttons)
  const getPageNumbers = () => {
    const maxButtons = 5
    const totalPages = meta.lastPage

    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    if (page <= 3) {
      return [1, 2, 3, 4, 5]
    }

    if (page >= totalPages - 2) {
      return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }

    return [page - 2, page - 1, page, page + 1, page + 2]
  }

  return {
    // Data
    employees,
    departments,
    branches,
    meta,

    // Loading states
    isLoading,
    isFetching,
    isPlaceholderData,
    error,

    // Pagination info
    pagination,

    // Pagination controls
    goToPage,
    nextPage,
    previousPage,
    goToFirstPage,
    goToLastPage,
    setItemsPerPage,
    getPageNumbers,

    // Filter state
    filters: {
      search,
      status,
      departmentId,
      branchId,
    },

    // Filter controls
    setSearch: setSearchQuery,
    setStatus: setStatusFilter,
    setDepartment: setDepartmentFilter,
    setBranch: setBranchFilter,
    setFilters,
    clearFilters,
    hasActiveFilters,

    // Manual refetch
    refetch,
  }
}
