'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { STALE } from '@/src/libs/query/stale-times'
import type { SupplierListItem } from '@/src/schema/inventory/suppliers'
import { listSuppliers } from '../_actions/list-suppliers'
import type { SupplierStatus } from '../_lib/supplier-format'

export type StatusFilter = 'all' | SupplierStatus

export type SupplierFilters = {
  query: string
  status: StatusFilter
  /** Narrows to the ones whose onboarding has not been signed off — the
   * queue somebody has to work through, rather than a status of its own. */
  needsAttention: boolean
}

const EMPTY_FILTERS: SupplierFilters = { query: '', status: 'all', needsAttention: false }

/** One page big enough to hold the whole book — see the comment on the hook. */
const PAGE_SIZE = 500

function matchesQuery(supplier: SupplierListItem, q: string): boolean {
  if (!q) return true
  return [supplier.name, supplier.code, supplier.contactPerson, supplier.email]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(q)
}

/**
 * Every supplier, fetched once and filtered here rather than per keystroke on
 * the server. The pills count the whole set, so a server page could report
 * numbers the rows under it contradict; and a directory this size (hundreds,
 * not thousands) is cheaper to hold than to re-request.
 *
 * Selection lives here too: the list owns which row is current, so a filter
 * that hides the selected supplier can drop the selection in the same pass
 * instead of leaving the panel showing a row that is no longer on screen.
 */
export function useSuppliers() {
  const [filters, setFiltersState] = useState<SupplierFilters>(EMPTY_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['suppliers-directory'],
    queryFn: () => listSuppliers({ limit: PAGE_SIZE }),
    staleTime: STALE.OPERATIONAL,
  })

  const allSuppliers = useMemo(() => query.data?.data?.data ?? [], [query.data])

  const stats = useMemo(() => {
    let active = 0
    let inactive = 0
    let blacklisted = 0
    let needsAttention = 0
    for (const s of allSuppliers) {
      if (s.status === 'active') active++
      else if (s.status === 'inactive') inactive++
      else blacklisted++
      if (s.onboardingStatus !== 'approved') needsAttention++
    }
    return { total: allSuppliers.length, active, inactive, blacklisted, needsAttention }
  }, [allSuppliers])

  const suppliers = useMemo(() => {
    const q = filters.query.trim().toLowerCase()
    return allSuppliers
      .filter((s) => {
        if (filters.status !== 'all' && s.status !== filters.status) return false
        if (filters.needsAttention && s.onboardingStatus === 'approved') return false
        return matchesQuery(s, q)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [allSuppliers, filters])

  const selected = useMemo(
    () => suppliers.find((s) => s.id === selectedId) ?? null,
    [suppliers, selectedId]
  )

  const setFilters = useCallback((patch: Partial<SupplierFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }))
  }, [])

  const hasActiveFilters =
    filters.query !== '' || filters.status !== 'all' || filters.needsAttention

  return {
    suppliers,
    allSuppliers,
    stats,
    filters,
    setFilters,
    resetFilters: () => setFiltersState(EMPTY_FILTERS),
    hasActiveFilters,
    /** null when nothing is picked, or when the current filters hide it. */
    selected,
    selectedId,
    select: setSelectedId,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}
