'use client'

import { X, RefreshCw } from 'lucide-react'
import { useStockLedger } from '../_hooks/useStockLedger'

const TX_LABELS: Record<string, string> = {
  receipt: 'Receipt',
  sale: 'Sale',
  transfer_out: 'Transfer Out',
  transfer_in: 'Transfer In',
  adjustment: 'Adjustment',
  return: 'Return',
  write_off: 'Write-off',
}

const TX_COLORS: Record<string, string> = {
  receipt: 'bg-green-100 text-green-700',
  sale: 'bg-blue-100 text-blue-700',
  transfer_out: 'bg-amber-100 text-amber-700',
  transfer_in: 'bg-teal-100 text-teal-700',
  adjustment: 'bg-purple-100 text-purple-700',
  return: 'bg-orange-100 text-orange-700',
  write_off: 'bg-red-100 text-red-700',
}

const TRANSACTION_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'sale', label: 'Sale' },
  { value: 'transfer_out', label: 'Transfer Out' },
  { value: 'transfer_in', label: 'Transfer In' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'return', label: 'Return' },
  { value: 'write_off', label: 'Write-off' },
]

export default function StockLedgerTab() {
  const {
    entries,
    total,
    page,
    limit,
    totalPages,
    isLoading,
    isFetching,
    warehouseId,
    transactionType,
    startDate,
    endDate,
    setWarehouseId,
    setTransactionType,
    setStartDate,
    setEndDate,
    resetFilters,
    setPage,
    warehouseOptions,
  } = useStockLedger()

  const hasFilters = warehouseId || transactionType || startDate || endDate

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={warehouseId ?? ''}
          onChange={(e) => setWarehouseId(e.target.value || undefined)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
        >
          <option value="">All Warehouses</option>
          {warehouseOptions.map((wh) => (
            <option key={wh.id} value={wh.id}>
              {wh.code} — {wh.name}
            </option>
          ))}
        </select>

        <select
          value={transactionType ?? ''}
          onChange={(e) => setTransactionType(e.target.value || undefined)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
        >
          {TRANSACTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

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

      {/* Table */}
      <div
        className={`overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
      >
        {isLoading ? (
          <div className="divide-y divide-zinc-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <div className="h-5 w-20 animate-pulse rounded-full bg-zinc-200" />
                <div className="h-4 w-36 animate-pulse rounded bg-zinc-200" />
                <div className="ml-auto h-4 w-12 animate-pulse rounded bg-zinc-200" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm font-medium text-zinc-500">No movements found</p>
            <p className="mt-1 text-xs text-zinc-400">Try adjusting the filters above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Item
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                    Warehouse
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                    Branch
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden xl:table-cell">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {entries.map((entry) => {
                  const colorClass = TX_COLORS[entry.transactionType] ?? 'bg-zinc-100 text-zinc-600'
                  const label = TX_LABELS[entry.transactionType] ?? entry.transactionType
                  const date = entry.occurredAt ?? entry.createdAt
                  return (
                    <tr key={entry.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
                        >
                          {label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">{entry.item?.name ?? '—'}</p>
                        {entry.item?.sku && (
                          <p className="font-mono text-xs text-zinc-400">{entry.item.sku}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">
                        {entry.warehouse?.code ?? '—'}
                        {entry.warehouse?.name && (
                          <span className="ml-1 text-zinc-400">({entry.warehouse.name})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {entry.warehouse?.branch ? (
                          <span className="text-zinc-700">{entry.warehouse.branch.name}</span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-semibold ${entry.quantity >= 0 ? 'text-green-700' : 'text-red-600'}`}
                        >
                          {entry.quantity >= 0 ? `+${entry.quantity}` : entry.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 hidden md:table-cell">
                        {date
                          ? new Date(date).toLocaleDateString('en-PH', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 hidden xl:table-cell max-w-xs truncate">
                        {entry.notes ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>
            {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} movements
          </span>
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
