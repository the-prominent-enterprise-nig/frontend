'use client'

import { X, RefreshCw, Landmark } from 'lucide-react'
import { useWithholdingSummary } from '../_hooks/useWithholdingSummary'
import { SupplierSearchCombobox } from '@/src/components/inventory/SupplierSearchCombobox'

export default function WithholdingSummaryTab() {
  const {
    rows,
    meta,
    page,
    totalPages,
    isLoading,
    isFetching,
    supplierId,
    startDate,
    endDate,
    setSupplierId,
    setStartDate,
    setEndDate,
    resetFilters,
    setPage,
  } = useWithholdingSummary()

  const hasFilters = supplierId || startDate || endDate

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px]">
          <SupplierSearchCombobox
            value={supplierId ?? ''}
            onChange={(id) => setSupplierId(id || undefined)}
          />
        </div>

        <input
          type="date"
          value={startDate ?? ''}
          onChange={(e) => setStartDate(e.target.value || undefined)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
        />
        <span className="text-xs text-zinc-400">to</span>
        <input
          type="date"
          value={endDate ?? ''}
          onChange={(e) => setEndDate(e.target.value || undefined)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
        />

        {hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" /> Clear
          </button>
        )}

        {isFetching && !isLoading && <RefreshCw className="h-4 w-4 animate-spin text-zinc-400" />}
      </div>

      {/* Total withheld strip */}
      {!isLoading && rows.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
            <Landmark className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-zinc-400">Total withheld this period</p>
            <p className="text-lg font-semibold text-zinc-900">
              ₱{(meta?.totalWithheld ?? 0).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div
        className={`overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
      >
        {isLoading ? (
          <div className="divide-y divide-zinc-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
                <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
                <div className="ml-auto h-4 w-20 animate-pulse rounded bg-zinc-200" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm font-medium text-zinc-500">No withheld amounts for this period</p>
            <p className="mt-1 text-xs text-zinc-400">
              Flag a Receiving Report as &ldquo;1% Withholding&rdquo; to see it summarized here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    GRN Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                    Date Received
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Withheld Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-mono font-medium text-zinc-900">{row.code}</td>
                    <td className="px-4 py-3 text-zinc-700">{row.supplier?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-500 hidden md:table-cell">
                      {new Date(row.receivedAt).toLocaleDateString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-600">
                      ₱{(row.withheldAmount ?? 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>{meta?.total ?? 0} receipts</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 font-medium text-zinc-700">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
