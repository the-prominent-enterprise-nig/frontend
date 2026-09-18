'use client'

import { useMemo } from 'react'
import { Search, X } from 'lucide-react'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { locationLabel } from '@/src/libs/format/locationLabel'
import type { WarehouseSummary } from '@/src/schema/inventory/warehouses'
import type { DateRange } from '../../_hooks/useReturnsManager'

const INPUT =
  'rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-prominent-purple-500 focus:ring-2 focus:ring-prominent-purple-100'

/** The three answers that cover nearly every visit, plus the escape hatch. */
const RANGES: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'Any date' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range…' },
]

type Props = {
  search: string
  onSearch: (value: string) => void
  warehouseFilter?: string
  onWarehouse: (value: string | undefined) => void
  dateRange: DateRange
  onDateRange: (value: DateRange) => void
  fromDate?: string
  toDate?: string
  onFromDate: (value: string | undefined) => void
  onToDate: (value: string | undefined) => void
  warehouseOptions: WarehouseSummary[]
  hasActiveFilters: boolean
  onReset: () => void
}

/**
 * One search box and two narrowings.
 *
 * The box is first and widest because it is the only one that answers the
 * question people actually arrive with — a customer quoting an RR, a serial
 * or an RTN number. Which shape of record used to be a third dropdown here
 * and is now the band above, where its sizes are readable without a click.
 *
 * The date pair became a preset, because "last 7 days" was what both boxes
 * were being filled in to say. Picking two dates by hand is still there for
 * the month-end case, one option down.
 */
export default function ReturnFilters({
  search,
  onSearch,
  warehouseFilter,
  onWarehouse,
  dateRange,
  onDateRange,
  fromDate,
  toDate,
  onFromDate,
  onToDate,
  warehouseOptions,
  hasActiveFilters,
  onReset,
}: Props) {
  // Held still between renders — SearchableSelect filters off this array's
  // identity, so a fresh one every render re-runs the filter on every
  // keystroke typed into it.
  const locationChoices = useMemo(
    () => warehouseOptions.map((w) => ({ value: w.id, label: locationLabel(w) })),
    [warehouseOptions]
  )

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[16rem] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="Search returns"
          placeholder="RTN, RR, invoice, credit memo, serial, item or customer…"
          className={`${INPUT} w-full pl-9`}
        />
      </div>

      {/* Type-ahead rather than a native <select>: there are 40-odd
          locations, and scrolling a list that long to find the one branch you
          work at is the part nobody could do quickly. Clearable, because
          clearing it is what "all locations" means. */}
      <SearchableSelect
        className="w-[190px]"
        value={warehouseFilter ?? ''}
        onChange={(value) => onWarehouse(value || undefined)}
        placeholder="All locations"
        clearable
        options={locationChoices}
      />

      <select
        value={dateRange}
        onChange={(e) => onDateRange(e.target.value as DateRange)}
        aria-label="Date range"
        className={`${INPUT} cursor-pointer`}
      >
        {RANGES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>

      {dateRange === 'custom' && (
        <>
          <input
            type="date"
            value={fromDate ?? ''}
            onChange={(e) => onFromDate(e.target.value || undefined)}
            className={`${INPUT} cursor-pointer`}
            aria-label="From date"
            title="From date"
          />
          <input
            type="date"
            value={toDate ?? ''}
            onChange={(e) => onToDate(e.target.value || undefined)}
            className={`${INPUT} cursor-pointer`}
            aria-label="To date"
            title="To date"
          />
        </>
      )}

      {hasActiveFilters && (
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
        >
          <X className="h-4 w-4" />
          Clear filters
        </button>
      )}
    </div>
  )
}
