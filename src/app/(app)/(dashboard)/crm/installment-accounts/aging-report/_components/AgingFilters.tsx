'use client'

import { useMemo } from 'react'
import { useUrlFilters } from '@/src/components/ssr/UrlFilters'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import type { AgingFilterOptions } from '../_data'
import type { AgingFilters as AgingFilterValues } from '../_params'

/**
 * The filter bar. Every change writes the URL; the server re-renders the report
 * for the new filters (see UrlFiltersProvider). Options come from the server
 * so the dropdowns are populated in the first paint.
 */
export function AgingFilters({
  options,
  values,
}: {
  options: AgingFilterOptions
  values: AgingFilterValues
}): React.JSX.Element {
  const { setParams } = useUrlFilters()

  const supervisors = useMemo(
    () =>
      [
        ...new Set(options.collectors.map((c) => c.supervisorName).filter((v): v is string => !!v)),
      ].sort(),
    [options.collectors]
  )

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <label className="flex items-center gap-2 text-sm text-gray-600">
        As of
        <input
          type="date"
          value={values.asOf}
          onChange={(event) => setParams({ asOf: event.target.value })}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        />
      </label>
      <SearchableSelect
        value={values.branchId ?? ''}
        onChange={(value) => setParams({ branchId: value })}
        options={options.branches.map((b) => ({ value: b.id, label: b.name }))}
        placeholder="All branches"
        clearable
        portal
        className="w-48"
      />
      <SearchableSelect
        value={values.supervisorName ?? ''}
        onChange={(value) => setParams({ supervisorName: value })}
        options={supervisors.map((s) => ({ value: s, label: s }))}
        placeholder="All supervisors"
        clearable
        portal
        className="w-48"
      />
      <SearchableSelect
        value={values.collectorId ?? ''}
        onChange={(value) => setParams({ collectorId: value })}
        options={options.collectors.map((c) => ({
          value: c.id,
          label: `${c.stubNumber} — ${c.name}`,
        }))}
        placeholder="All collectors"
        clearable
        portal
        className="w-56"
      />
    </div>
  )
}
