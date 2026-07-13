'use client'

import { X, RefreshCw, Activity } from 'lucide-react'
import { useItemLedger } from '../hooks/useItemLedger'

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

type Props = {
  itemId: string
}

export default function MovementsTab({ itemId }: Props) {
  const {
    currentBalances,
    openingBalance,
    entries,
    meta,
    isLoading,
    isFetching,
    page,
    setPage,
    warehouseId,
    setWarehouseId,
    transactionType,
    setTransactionType,
    warehouseOptions,
    resetFilters,
  } = useItemLedger(itemId)

  const hasFilters = !!warehouseId || !!transactionType
  const totalPages = meta?.lastPage ?? 1
  const total = meta?.total ?? 0

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Current stock summary */}
      {currentBalances.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Current Stock
          </p>
          <div className="flex flex-wrap gap-2">
            {currentBalances.map((b, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs"
              >
                <span className="font-medium text-zinc-700">
                  {b.warehouse?.code ?? b.warehouse?.name ?? 'Unknown'}
                </span>
                <span className="text-zinc-400">·</span>
                <span className="font-semibold text-zinc-900">{b.availableQty}</span>
                <span className="text-zinc-400">avail</span>
                {b.reservedQty > 0 && (
                  <span className="text-zinc-400">· {b.reservedQty} reserved</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={warehouseId ?? ''}
          onChange={(e) => setWarehouseId(e.target.value || undefined)}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-prominent-purple-500"
        >
          <option value="">All Warehouses</option>
          {warehouseOptions.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </select>

        <select
          value={transactionType ?? ''}
          onChange={(e) => setTransactionType(e.target.value || undefined)}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-prominent-purple-500"
        >
          {TRANSACTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}

        {isFetching && !isLoading && (
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-zinc-400" />
        )}
      </div>

      {/* Opening balance */}
      {!isLoading && (
        <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs">
          <span className="text-zinc-500">Opening Balance</span>
          <span
            className={`font-semibold tabular-nums ${openingBalance >= 0 ? 'text-zinc-700' : 'text-red-600'}`}
          >
            {openingBalance >= 0 ? `+${openingBalance}` : openingBalance}
          </span>
        </div>
      )}

      {/* Ledger entries */}
      <div
        className={`overflow-hidden rounded-xl border border-zinc-200 bg-white transition-opacity ${isFetching ? 'opacity-60' : ''}`}
      >
        {isLoading ? (
          <div className="divide-y divide-zinc-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-5 w-20 animate-pulse rounded-full bg-zinc-200" />
                <div className="h-4 w-28 animate-pulse rounded bg-zinc-200" />
                <div className="ml-auto h-4 w-12 animate-pulse rounded bg-zinc-200" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="mb-3 h-8 w-8 text-zinc-300" />
            <p className="text-sm font-medium text-zinc-500">No movements found</p>
            <p className="mt-1 text-xs text-zinc-400">Try adjusting the filters above.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {entries.map((entry) => {
              const colorClass = TX_COLORS[entry.transactionType] ?? 'bg-zinc-100 text-zinc-600'
              const label = TX_LABELS[entry.transactionType] ?? entry.transactionType
              const hasIn = entry.quantityIn > 0
              const hasOut = entry.quantityOut > 0

              return (
                <div key={entry.id} className="px-4 py-3 hover:bg-zinc-50">
                  {/* Row 1: type + qty + balance */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${colorClass}`}
                      >
                        {label}
                      </span>
                      {entry.referenceCode && (
                        <span className="truncate font-mono text-[11px] text-zinc-400">
                          {entry.referenceCode}
                        </span>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-sm font-semibold tabular-nums">
                        {hasIn && <span className="text-green-700">+{entry.quantityIn}</span>}
                        {hasIn && hasOut && ' '}
                        {hasOut && <span className="text-red-600">−{entry.quantityOut}</span>}
                        {!hasIn && !hasOut && <span className="text-zinc-500">0</span>}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: warehouse + date + running balance */}
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {entry.warehouse && (
                        <span className="text-[11px] text-zinc-500">
                          {entry.warehouse.code}
                          {entry.warehouse.name && (
                            <span className="text-zinc-400"> · {entry.warehouse.name}</span>
                          )}
                        </span>
                      )}
                      {entry.notes && (
                        <span className="truncate text-[11px] italic text-zinc-400">
                          {entry.notes}
                        </span>
                      )}
                    </div>
                    <div className="shrink-0 text-right text-[11px] text-zinc-400">
                      <span>
                        {new Date(entry.occurredAt).toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="ml-2 font-medium text-zinc-600">
                        Bal: {entry.runningBalance}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>
            {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded-lg px-2.5 py-1 hover:bg-zinc-100 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-2 font-medium text-zinc-700">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="rounded-lg px-2.5 py-1 hover:bg-zinc-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
