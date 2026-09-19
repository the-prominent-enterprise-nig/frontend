'use client'

import { Search, X } from 'lucide-react'
import type { SupplierListItem } from '@/src/schema/inventory/suppliers'
import { MONO } from '@/src/libs/design/plex'
import { ONBOARDING_META, rowMeta, STATUS_META } from '../_lib/supplier-format'

/**
 * The left-hand column: one row per supplier, each saying enough to pick from
 * without opening it — whether it may be used, what kind of payee it is, the
 * terms it buys on and who to call.
 *
 * Deliberately not the app's table: this is a picker beside a detail panel, so
 * a row is two lines of prose rather than columns to scan across.
 */
export default function SupplierList({
  suppliers,
  totalCount,
  selectedId,
  query,
  onQueryChange,
  onSelect,
  isLoading,
  onClearFilters,
}: {
  suppliers: SupplierListItem[]
  /** Everything on file, before filters — tells an empty result which of the
   * two empty states to show. */
  totalCount: number
  selectedId: string | null
  query: string
  onQueryChange: (value: string) => void
  onSelect: (id: string) => void
  isLoading: boolean
  onClearFilters: () => void
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b8b9b]" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search name, code, contact, or email…"
          aria-label="Search suppliers"
          className="w-full rounded-lg border border-[#d3d3db] bg-white py-2 pl-9 pr-8 text-sm text-[#17171c] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]"
        />
        {query !== '' && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label="Clear search"
            title="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#8b8b9b] hover:text-[#3d3d4a]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e4e4e9] bg-white lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-[#8b8b9b]">Loading suppliers…</p>
        ) : suppliers.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-[#3d3d4a]">
              {totalCount === 0 ? 'No suppliers yet' : 'Nothing matches'}
            </p>
            <p className="mx-auto mt-1 max-w-[16rem] text-xs leading-relaxed text-[#5b5b6b]">
              {totalCount === 0
                ? 'Add the first one to start raising purchase orders against it.'
                : query
                  ? `No supplier matches “${query}” inside the current filters.`
                  : 'No supplier falls inside these filters.'}
            </p>
            {totalCount > 0 && (
              <button
                type="button"
                onClick={onClearFilters}
                className="mt-3 rounded-lg border border-[#e4e4e9] px-3 py-1.5 text-xs font-medium text-[#3d3d4a] hover:border-[#d3d3db] hover:bg-[#fbfbfc]"
              >
                Clear search and filters
              </button>
            )}
          </div>
        ) : (
          <ul>
            {suppliers.map((supplier, index) => {
              const isOn = supplier.id === selectedId
              const status = STATUS_META[supplier.status]
              const onboarding = ONBOARDING_META[supplier.onboardingStatus]
              const unfinished = supplier.onboardingStatus !== 'approved'
              return (
                <li key={supplier.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(supplier.id)}
                    aria-current={isOn ? 'true' : undefined}
                    className={`flex w-full items-start gap-2.5 px-4 py-3 text-left ${
                      index ? 'border-t border-[#f4f4f6]' : ''
                    } ${
                      isOn
                        ? 'bg-[#faf7ff] shadow-[inset_3px_0_0_#5b21b6]'
                        : 'bg-white hover:bg-[#fbfbfc]'
                    }`}
                  >
                    <span
                      title={status.hint}
                      className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-[13px] ${
                          isOn ? 'font-semibold' : 'font-medium'
                        } ${supplier.status === 'blacklisted' ? 'text-[#b42318]' : 'text-[#17171c]'}`}
                        title={supplier.name}
                      >
                        {supplier.name}
                      </span>
                      <span className={`${MONO} mt-1 block text-[10.5px] text-[#5b5b6b]`}>
                        {supplier.code}
                      </span>
                      <span className="mt-0.5 block truncate text-[10.5px] text-[#5b5b6b]">
                        {rowMeta(supplier)}
                      </span>
                    </span>
                    {unfinished && (
                      <span
                        title={onboarding.hint}
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${onboarding.chip}`}
                      >
                        {supplier.onboardingStatus === 'blocked' ? 'blocked' : 'review'}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
