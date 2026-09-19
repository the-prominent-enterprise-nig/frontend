'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getPriceLists } from '../_actions/get-price-lists'
import { createPriceList } from '../_actions/create-price-list'
import { updatePriceList } from '../_actions/update-price-list'
import { approvePriceList } from '../_actions/approve-price-list'
import { rejectPriceList } from '../_actions/reject-price-list'
import { resubmitPriceList } from '../_actions/resubmit-price-list'
import { deletePriceList } from '../_actions/delete-price-list'
import { getBranches } from '../_actions/get-branches'
import { getCatalogTotal } from '../_actions/get-catalog-total'
import { getPriceUseTypes } from '../../price-use-types/_actions/get-price-use-types'
import { createPriceUseType } from '../../price-use-types/_actions/create-price-use-type'
import { humanizePriceListError } from '../_lib/humanize-error'
import type {
  ApprovePriceListFormValues,
  PriceListFormValues,
  RejectPriceListFormValues,
} from '@/src/schema/inventory/price-lists'
import type { PriceUseTypeFormValues } from '@/src/schema/inventory/price-use-types'
import type { PriceList } from '@/src/schema/inventory/price-lists'
import { RETIRED_STATUSES, THIN_COVERAGE_THRESHOLD } from '../_lib/price-list-format'

const PAGE_SIZE = 20

export type PriceListSort = 'items' | 'priority' | 'name'

/** Everything the toolbar can narrow the table by. Held together so a
 * change to any one of them can reset pagination in a single place. */
export type PriceListFilters = {
  query: string
  status: string
  priceUseTypeId: string
  sort: PriceListSort
}

const EMPTY_FILTERS: PriceListFilters = {
  query: '',
  status: 'all',
  priceUseTypeId: 'all',
  sort: 'items',
}

function matchesQuery(pl: PriceList, query: string) {
  if (!query) return true
  const haystack = [pl.name, pl.description ?? '', pl.priceUseType?.name ?? '', pl.currency]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function usePriceLists() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [filters, setFiltersState] = useState<PriceListFilters>(EMPTY_FILTERS)

  // The whole (unpaginated) set is pulled once and narrowed in the browser.
  // The coverage band and the status pills both count across everything, not
  // just the visible page, so a server-side page would make every one of
  // those numbers a lie. Retired rows come down too — they are what the
  // "Not selling" tile counts — and the status filter is what hides them.
  const listQuery = useQuery({
    queryKey: ['inventory-price-lists'],
    queryFn: async () => {
      const result = await getPriceLists({ page: 1, limit: 1000, includeInactive: true })
      if (!result.success) throw new Error(result.message ?? 'Failed to load price lists')
      return result
    },
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    // Scenario 26 — same gap found live across every maker-checker list
    // this scenario touched: staleTime alone only refetches on THIS tab's
    // own refocus/remount, not when someone else's approve/reject changes
    // the record in a different browser tab/session.
    refetchInterval: 10 * 1000,
  })

  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: getBranches,
    staleTime: 10 * 60 * 1000,
  })

  const priceUseTypesQuery = useQuery({
    queryKey: ['inventory-price-use-types'],
    queryFn: getPriceUseTypes,
    staleTime: 30 * 1000,
  })

  // Denominator for "376 of 1,412 items priced". Slow-moving, so it is
  // cached far longer than the lists themselves.
  const catalogTotalQuery = useQuery({
    queryKey: ['inventory-catalog-total'],
    queryFn: getCatalogTotal,
    staleTime: 10 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: PriceListFormValues) => createPriceList(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Price list created', description: result.message, status: 'success' })
        queryClient.refetchQueries({ queryKey: ['inventory-price-lists'] })
      } else {
        showToast({
          title: 'Failed',
          description: humanizePriceListError(result.message),
          status: 'error',
        })
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PriceListFormValues }) =>
      updatePriceList(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Price list updated', description: result.message, status: 'success' })
        queryClient.refetchQueries({ queryKey: ['inventory-price-lists'] })
      } else {
        showToast({
          title: 'Failed',
          description: humanizePriceListError(result.message),
          status: 'error',
        })
      }
    },
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApprovePriceListFormValues }) =>
      approvePriceList(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Price list approved', description: result.message, status: 'success' })
        queryClient.refetchQueries({ queryKey: ['inventory-price-lists'] })
      } else {
        showToast({
          title: 'Failed',
          description: humanizePriceListError(result.message),
          status: 'error',
        })
      }
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectPriceListFormValues }) =>
      rejectPriceList(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Price list rejected', description: result.message, status: 'success' })
        queryClient.refetchQueries({ queryKey: ['inventory-price-lists'] })
      } else {
        showToast({
          title: 'Failed',
          description: humanizePriceListError(result.message),
          status: 'error',
        })
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePriceList(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Price list deleted', description: result.message, status: 'success' })
        queryClient.refetchQueries({ queryKey: ['inventory-price-lists'] })
      } else {
        showToast({
          title: 'Failed',
          description: humanizePriceListError(result.message),
          status: 'error',
        })
      }
    },
  })

  const createPriceUseTypeMutation = useMutation({
    mutationFn: (data: PriceUseTypeFormValues) => createPriceUseType(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Price use type created', status: 'success' })
        queryClient.refetchQueries({ queryKey: ['inventory-price-use-types'] })
      } else {
        showToast({
          title: 'Failed',
          description: humanizePriceListError(result.message),
          status: 'error',
        })
      }
    },
  })

  const resubmitMutation = useMutation({
    mutationFn: (id: string) => resubmitPriceList(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Resubmitted for approval',
          description: result.message,
          status: 'success',
        })
        queryClient.refetchQueries({ queryKey: ['inventory-price-lists'] })
      } else {
        showToast({
          title: 'Failed',
          description: humanizePriceListError(result.message),
          status: 'error',
        })
      }
    },
  })

  const allPriceLists: PriceList[] = listQuery.data?.data?.data ?? []
  const catalogTotal = catalogTotalQuery.data ?? 0

  const query = filters.query.trim().toLowerCase()
  const filtered = allPriceLists.filter((pl) => {
    if (filters.status !== 'all' && pl.status !== filters.status) return false
    if (filters.priceUseTypeId !== 'all' && pl.priceUseTypeId !== filters.priceUseTypeId)
      return false
    return matchesQuery(pl, query)
  })

  const sorted = [...filtered].sort((a, b) => {
    if (filters.sort === 'name') return a.name.localeCompare(b.name)
    if (filters.sort === 'priority') return b.priority - a.priority
    return (b.itemCount ?? 0) - (a.itemCount ?? 0)
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  // A filter change can strand the reader on a page that no longer exists;
  // clamp rather than render an empty table with a live "Next" button.
  const safePage = Math.min(page, totalPages)
  const priceLists = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function countByStatus(status: string) {
    return allPriceLists.filter((pl) => pl.status === status).length
  }

  const activeLists = allPriceLists.filter((pl) => pl.status === 'active')
  const stats = {
    total: allPriceLists.length,
    active: activeLists.length,
    pending: countByStatus('pending_approval'),
    rejected: countByStatus('rejected'),
    retired: allPriceLists.filter((pl) => RETIRED_STATUSES.includes(pl.status)).length,
    // Live lists that price only a sliver of the catalog: everything they
    // miss silently falls through to whatever list is next by priority.
    thinCoverage: catalogTotal
      ? activeLists.filter(
          (pl) => ((pl.itemCount ?? 0) / catalogTotal) * 100 < THIN_COVERAGE_THRESHOLD
        ).length
      : 0,
  }

  function setFilters(patch: Partial<PriceListFilters>) {
    setFiltersState((current) => ({ ...current, ...patch }))
    setPage(1)
  }

  return {
    priceLists,
    allPriceLists,
    catalogTotal,
    stats,
    filters,
    setFilters,
    resetFilters: () => {
      setFiltersState(EMPTY_FILTERS)
      setPage(1)
    },
    hasActiveFilters:
      filters.query !== '' || filters.status !== 'all' || filters.priceUseTypeId !== 'all',
    pagination: {
      total: sorted.length,
      page: safePage,
      limit: PAGE_SIZE,
      totalPages,
    },
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    error: listQuery.error,
    page: safePage,
    setPage,
    branches: branchesQuery.data ?? [],
    priceUseTypes: priceUseTypesQuery.data ?? [],
    createPriceUseType: createPriceUseTypeMutation.mutateAsync,
    isCreatingPriceUseType: createPriceUseTypeMutation.isPending,
    createPriceList: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updatePriceList: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    approvePriceList: approveMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    rejectPriceList: rejectMutation.mutateAsync,
    isRejecting: rejectMutation.isPending,
    resubmitPriceList: resubmitMutation.mutateAsync,
    isResubmitting: resubmitMutation.isPending,
    deletePriceList: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    refetch: () => queryClient.refetchQueries({ queryKey: ['inventory-price-lists'] }),
  }
}
