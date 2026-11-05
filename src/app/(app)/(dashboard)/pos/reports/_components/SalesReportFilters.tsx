'use client'

import ReportDateRange, { type DateRange } from '@/src/components/common/ReportDateRange'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import type { SalesFilterOptions } from '@/src/schema/pos/sales-reports'
import type { SalesFilterKey, SalesReportFilters } from '../_hooks/useSalesReportFilters'

interface Props {
  filters: SalesReportFilters
  options: SalesFilterOptions | undefined
  loading: boolean
  onRange: (range: DateRange) => void
  onFilter: (key: SalesFilterKey, value: string) => void
  onRegion: (region: string, branchStillValid: boolean) => void
  onClear: () => void
  hasFilters: boolean
}

type Option = { id: string; name: string }

function toOptions(list: Option[] | undefined): { value: string; label: string }[] {
  return (list ?? []).map((o) => ({ value: o.id, label: o.name }))
}

/** Scenario 85 — the filter bar every Sales Reports tab shares. */
export default function SalesReportFilters({
  filters,
  options,
  loading,
  onRange,
  onFilter,
  onRegion,
  onClear,
  hasFilters,
}: Props): React.JSX.Element {
  const branches = (options?.branches ?? []).filter(
    (b) => !filters.region || b.region === filters.region
  )

  function changeRegion(region: string): void {
    const branch = options?.branches.find((b) => b.id === filters.branch)
    onRegion(region, !filters.branch || !region || branch?.region === region)
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-end gap-3">
        <ReportDateRange value={filters.range} onChange={onRange} showPresets={false} />
        <Filter label="Region">
          <SearchableSelect
            value={filters.region}
            onChange={changeRegion}
            options={toOptions(options?.regions)}
            placeholder="All regions"
            loading={loading}
            clearable
            portal
          />
        </Filter>
        <Filter label="Branch">
          <SearchableSelect
            value={options?.branchLocked ? (options.branches[0]?.id ?? '') : filters.branch}
            onChange={(v) => onFilter('branch', v)}
            options={toOptions(branches)}
            placeholder="All branches"
            loading={loading}
            disabled={options?.branchLocked}
            clearable={!options?.branchLocked}
            portal
          />
        </Filter>
        <Filter label="Type">
          <SearchableSelect
            value={filters.type}
            onChange={(v) => onFilter('type', v)}
            options={toOptions(options?.types)}
            placeholder="All types"
            loading={loading}
            clearable
            portal
          />
        </Filter>
        <Filter label="Group">
          <SearchableSelect
            value={filters.group}
            onChange={(v) => onFilter('group', v)}
            options={toOptions(options?.groups)}
            placeholder="All groups"
            loading={loading}
            clearable
            portal
          />
        </Filter>
        <Filter label="Brand">
          <SearchableSelect
            value={filters.brand}
            onChange={(v) => onFilter('brand', v)}
            options={toOptions(options?.brands)}
            placeholder="All brands"
            loading={loading}
            clearable
            portal
          />
        </Filter>
        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg px-2.5 py-2 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
          >
            Clear filters
          </button>
        )}
      </div>
    </section>
  )
}

function Filter({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label className="flex w-40 flex-col gap-1 text-xs text-zinc-600">
      {label}
      {children}
    </label>
  )
}
