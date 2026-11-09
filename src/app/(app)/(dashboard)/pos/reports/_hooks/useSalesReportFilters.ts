'use client'

import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { DateRange } from '@/src/components/common/ReportDateRange'
import type { SalesReportsParams } from '@/src/schema/pos/sales-reports'

/** Scenario 85 — the three Sales Reports tabs. */
export type SalesReportsTab = 'dashboard' | 'branch' | 'report'
const TABS: SalesReportsTab[] = ['dashboard', 'branch', 'report']

export type SalesFilterKey = 'region' | 'branch' | 'type' | 'group' | 'brand'
const FILTER_KEYS: SalesFilterKey[] = ['region', 'branch', 'type', 'group', 'brand']

export interface SalesReportFilters {
  tab: SalesReportsTab
  /** Dashboard and Sales Report. */
  range: DateRange
  /** Sales per Branch keeps its own dates: quotas are monthly, so it opens on
   * this month to date rather than the Dashboard's twelve months. */
  branchRange: DateRange
  region: string
  branch: string
  type: string
  group: string
  brand: string
}

function iso(d: Date): string {
  // Local-date ISO — toISOString() would shift a PH-local date back a day.
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

/** Twelve months to date: the first of the month eleven months back, through
 * today — the span the Dashboard's month-by-month panels are built for. */
export function defaultRange(now = new Date()): DateRange {
  return { from: iso(new Date(now.getFullYear(), now.getMonth() - 11, 1)), to: iso(now) }
}

/** This month to date — Sales per Branch's default. */
export function monthToDate(now = new Date()): DateRange {
  return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) }
}

function readFilters(params: URLSearchParams): SalesReportFilters {
  const tab = params.get('tab') as SalesReportsTab | null
  const fallback = defaultRange()
  const linked = { from: params.get('from'), to: params.get('to') }
  return {
    tab: tab && TABS.includes(tab) ? tab : 'dashboard',
    range: { from: linked.from ?? fallback.from, to: linked.to ?? fallback.to },
    branchRange:
      tab === 'branch' && linked.from && linked.to
        ? { from: linked.from, to: linked.to }
        : monthToDate(),
    region: params.get('region') ?? '',
    branch: params.get('branch') ?? '',
    type: params.get('type') ?? '',
    group: params.get('group') ?? '',
    brand: params.get('brand') ?? '',
  }
}

/** The date range the active tab reads. */
export function activeRange(filters: SalesReportFilters): DateRange {
  return filters.tab === 'branch' ? filters.branchRange : filters.range
}

/** The filters as the backend takes them. Empty values are left off. */
export function toApiParams(filters: SalesReportFilters): SalesReportsParams {
  const range = activeRange(filters)
  return {
    startDate: range.from || undefined,
    endDate: range.to || undefined,
    regions: filters.region || undefined,
    branchIds: filters.branch || undefined,
    itemTypeIds: filters.type || undefined,
    groupIds: filters.group || undefined,
    brandIds: filters.brand || undefined,
  }
}

/**
 * Tab and filters are one piece of React state shared by every tab, so
 * switching tabs keeps them. The URL is read once on load (a link such as
 * `?tab=report&region=negros` opens that view) but never written: the tabs
 * query through server actions, and a server action that settles after a
 * history.replaceState pushes back the URL it started under — observed here
 * wiping a just-chosen date range. Same family as the router.replace hang
 * noted elsewhere in this app.
 */
export function useSalesReportFilters() {
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState(() => readFilters(new URLSearchParams(searchParams)))
  const write = useCallback(
    (changes: Partial<SalesReportFilters>) => setFilters((prev) => ({ ...prev, ...changes })),
    []
  )

  return {
    filters,
    apiParams: useMemo(() => toApiParams(filters), [filters]),
    setTab: (tab: SalesReportsTab) => write({ tab }),
    /** Sets the active tab's dates. */
    setRange: (range: DateRange) =>
      write(filters.tab === 'branch' ? { branchRange: range } : { range }),
    setFilter: (key: SalesFilterKey, value: string) => write({ [key]: value }),
    /** Changing region clears a branch that isn't in it. */
    setRegion: (region: string, branchStillValid: boolean) =>
      write({ region, ...(branchStillValid ? {} : { branch: '' }) }),
    clearFilters: () => write(Object.fromEntries(FILTER_KEYS.map((k) => [k, '']))),
    hasFilters: FILTER_KEYS.some((k) => filters[k]),
  }
}
