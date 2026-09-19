'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SupplierDebitMemos, type SupplierDebitMemo } from '@/src/libs/data/AccountingV2Data'
import { shownStatus } from '../_lib/debit-memo-format'

/** 'all' plus the three states this lifecycle actually reaches. FINAL is the
 * stored value behind Inventory's "Approved" — see shownStatus. */
export type DebitMemoStatusFilter = 'all' | 'DRAFT' | 'FINAL' | 'VOID'

export type DebitMemoFilters = {
  query: string
  status: DebitMemoStatusFilter
  supplierId: string
}

const EMPTY_FILTERS: DebitMemoFilters = {
  query: '',
  status: 'all',
  supplierId: 'all',
}

function matchesQuery(memo: SupplierDebitMemo, q: string): boolean {
  if (!q) return true
  const haystack = [
    memo.memoNumber,
    memo.apBill?.billNumber,
    memo.deliveryReceiptNumber,
    memo.supplier?.name,
    memo.reason,
    ...(memo.lines ?? []).map(
      (l) => `${l.item?.sku ?? ''} ${l.item?.name ?? ''} ${l.description ?? ''}`
    ),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

/**
 * Every memo, fetched once and filtered here rather than per keystroke on the
 * server. Two reasons: the band's tiles and the status pills count the whole
 * set, so a server page could report numbers the rows below it contradict;
 * and the search has to reach into line items, which the list endpoint does
 * not search.
 */
export function useDebitMemos() {
  const [filters, setFiltersState] = useState<DebitMemoFilters>(EMPTY_FILTERS)

  const query = useQuery({
    queryKey: ['supplier-debit-memos'],
    queryFn: () => SupplierDebitMemos.list(),
    staleTime: 30_000,
  })

  const allMemos = useMemo(() => query.data?.data?.items ?? [], [query.data])

  const stats = useMemo(() => {
    let drafts = 0
    let approved = 0
    let voided = 0
    for (const memo of allMemos) {
      const status = shownStatus(memo.status)
      if (status === 'DRAFT') drafts++
      else if (status === 'APPROVED') approved++
      else voided++
    }
    return { total: allMemos.length, drafts, approved, voided }
  }, [allMemos])

  const suppliers = useMemo(() => {
    const byId = new Map<string, string>()
    for (const memo of allMemos) {
      if (memo.supplierId) byId.set(memo.supplierId, memo.supplier?.name ?? 'Unnamed supplier')
    }
    return [...byId]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [allMemos])

  const memos = useMemo(() => {
    const q = filters.query.trim().toLowerCase()
    return (
      allMemos
        .filter((memo) => {
          if (filters.status !== 'all' && memo.status !== filters.status) return false
          if (filters.supplierId !== 'all' && memo.supplierId !== filters.supplierId) return false
          return matchesQuery(memo, q)
        })
        // Newest first, then by number so same-day memos keep a stable order —
        // memoDate is date-only, so ties are otherwise arbitrary.
        .sort((a, b) => {
          const byDate = new Date(b.memoDate).getTime() - new Date(a.memoDate).getTime()
          return byDate !== 0 ? byDate : b.memoNumber.localeCompare(a.memoNumber)
        })
    )
  }, [allMemos, filters])

  const hasActiveFilters =
    filters.query !== '' || filters.status !== 'all' || filters.supplierId !== 'all'

  return {
    memos,
    allMemos,
    stats,
    suppliers,
    filters,
    setFilters: (patch: Partial<DebitMemoFilters>) =>
      setFiltersState((prev) => ({ ...prev, ...patch })),
    resetFilters: () => setFiltersState(EMPTY_FILTERS),
    hasActiveFilters,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}
