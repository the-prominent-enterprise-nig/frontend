'use client'

import { useSyncExternalStore } from 'react'

/** Ticket #24 follow-up — "when we view one invoice and click back to
 * Transactions, all filters are removed. You have to filter again." The list
 * remembers how it was left (for this browser tab) and comes back that way,
 * whether by "← Transactions", the browser's Back button or a refresh.
 *
 * Kept in the tab's storage rather than the page address: changing a Next.js
 * page's address remounts it, which threw away a search still being typed. */

export type SortDir = 'none' | 'asc' | 'desc'

export interface ApplyFilters {
  transactionType: string
  invoiceType: string
  status: string
  dateFrom: string
  dateTo: string
}

/** This page's own branch pick, and the top-bar branch it was made under —
 * it lapses once the top-bar branch changes. */
export interface BranchPick {
  under: string | null
  value: string
}

export interface ListFilters {
  search: string
  filters: ApplyFilters
  branchPick: BranchPick | null
  sort: SortDir
}

export const EMPTY_APPLY_FILTERS: ApplyFilters = {
  transactionType: '',
  invoiceType: '',
  status: '',
  dateFrom: '',
  dateTo: '',
}

const EMPTY_LIST_FILTERS: ListFilters = {
  search: '',
  filters: EMPTY_APPLY_FILTERS,
  branchPick: null,
  sort: 'none',
}

const STORAGE_KEY = 'pos.transactions.listFilters'

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Whatever was stored, read defensively — an older or hand-edited value
 * falls back field by field to "no filter". */
function parseSaved(raw: string | null): ListFilters {
  if (!raw) return EMPTY_LIST_FILTERS
  const saved = JSON.parse(raw) as Partial<Record<keyof ListFilters, unknown>>
  const f = (saved.filters ?? {}) as Partial<Record<keyof ApplyFilters, unknown>>
  const pick = saved.branchPick as Partial<BranchPick> | null | undefined
  return {
    search: str(saved.search),
    filters: {
      transactionType: str(f.transactionType),
      invoiceType: str(f.invoiceType),
      status: str(f.status),
      dateFrom: str(f.dateFrom),
      dateTo: str(f.dateTo),
    },
    branchPick:
      pick && typeof pick.value === 'string'
        ? { under: typeof pick.under === 'string' ? pick.under : null, value: pick.value }
        : null,
    sort: saved.sort === 'asc' || saved.sort === 'desc' ? saved.sort : 'none',
  }
}

/** Browser storage can be missing or blocked (private window, cleared site
 * data); the list then simply opens unfiltered. */
function loadListFilters(): ListFilters {
  try {
    return parseSaved(window.sessionStorage.getItem(STORAGE_KEY))
  } catch {
    return EMPTY_LIST_FILTERS
  }
}

export function saveListFilters(f: ListFilters): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(f))
  } catch {
    // Not remembered — the list opens unfiltered next time.
  }
}

/** Where the list starts. A link that brings its own search (an AR Invoice's
 * "Sale: <transactionNumber>") starts fresh on that search; otherwise the
 * list picks up where this tab left it. */
export function initialListFilters(params: { get(name: string): string | null }): ListFilters {
  const linkedSearch = params.get('search')
  if (linkedSearch !== null) return { ...EMPTY_LIST_FILTERS, search: linkedSearch }
  return loadListFilters()
}

const noSubscription = (): (() => void) => () => {}

/** False on the server and during hydration, true after — so what the tab
 * remembered is only read once the browser has taken over, and the first
 * client render matches the server's. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false
  )
}
