'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DR_PURPOSE_CONFIG, drPurposeLabel } from '@/src/libs/inventory/delivery-receipt-purposes'
import type { DrPurpose } from '@/src/schema/inventory/delivery-receipts'
import type { IdmDetail } from '@/src/schema/accounting/inventory-debit-memos'
import { getInventoryDebitMemos } from '../../../accounting/debit-memos/inventory/_actions/inventory-debit-memos'
import type { DebitMemoFilters } from './useDebitMemos'

/** The list's Type filter (Scenario 72): one of the purposes that carry a
 * debit memo. Every supplier memo is a "Return units to supplier"; the other
 * purposes are internal (DMINV) memos. */
export type MemoTypeFilter = 'all' | DrPurpose

export const SUPPLIER_PURPOSE: DrPurpose = 'return_to_supplier'

/** Read from the shared purpose settings, so the filter follows them. */
export const MEMO_TYPE_OPTIONS: { value: MemoTypeFilter; label: string }[] = [
  { value: 'all', label: 'All types' },
  ...(Object.entries(DR_PURPOSE_CONFIG) as [DrPurpose, (typeof DR_PURPOSE_CONFIG)[DrPurpose]][])
    .filter(([, config]) => config.withDebitMemo)
    .map(([value, config]) => ({ value, label: config.label })),
]

/** Inventory's status pills speak the supplier memo's words; an internal
 * memo's POSTED is the same place in its lifecycle as a supplier FINAL. */
const STATUS_FOR_PILL: Record<DebitMemoFilters['status'], IdmDetail['status'] | null> = {
  all: null,
  DRAFT: 'DRAFT',
  FINAL: 'POSTED',
  VOID: 'VOID',
}

function matchesQuery(memo: IdmDetail, q: string): boolean {
  if (!q) return true
  return [
    memo.memoNumber,
    memo.deliveryReceipt?.drNumber,
    memo.referenceNo,
    memo.reason,
    memo.purpose ? drPurposeLabel(memo.purpose) : null,
    memo.branch?.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(q)
}

/**
 * Scenario 72 — the internal DMINV memos, filtered by the same search and
 * status pills as the supplier memos so the two share one list. A supplier
 * filter has no meaning for them, so picking one hides them.
 */
export function useInternalMemos(filters: DebitMemoFilters, type: MemoTypeFilter) {
  const query = useQuery({
    queryKey: ['inventory-debit-memos', 'inventory-tab'],
    queryFn: () => getInventoryDebitMemos({ limit: 200 }),
    staleTime: 30_000,
  })
  const all = useMemo(() => query.data?.data?.data ?? [], [query.data])

  const stats = useMemo(
    () => ({
      total: all.length,
      drafts: all.filter((m) => m.status === 'DRAFT').length,
      approved: all.filter((m) => m.status === 'POSTED').length,
      voided: all.filter((m) => m.status === 'VOID').length,
    }),
    [all]
  )

  const memos = useMemo(() => {
    if (type === SUPPLIER_PURPOSE || filters.supplierId !== 'all') return []
    const status = STATUS_FOR_PILL[filters.status]
    const q = filters.query.trim().toLowerCase()
    return all.filter(
      (m) =>
        (type === 'all' || m.purpose === type) &&
        (!status || m.status === status) &&
        matchesQuery(m, q)
    )
  }, [all, filters, type])

  return { all, memos, stats, isLoading: query.isLoading, isFetching: query.isFetching }
}
