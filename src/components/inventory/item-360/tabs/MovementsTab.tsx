'use client'

import { X, RefreshCw, Activity } from 'lucide-react'
import { useItemLedger } from '../hooks/useItemLedger'
import type { ItemLedgerEntry } from '@/src/schema/inventory/items/ledger'
import {
  PLEX,
  MONO,
} from '@/src/app/(app)/(dashboard)/inventory/purchase-orders/_components/procurementTokens'

const TX_LABELS: Record<string, string> = {
  receipt: 'Receipt',
  sale: 'Sale',
  transfer_out: 'Transfer Out',
  transfer_in: 'Transfer In',
  adjustment: 'Adjustment',
  return: 'Return',
  write_off: 'Write-off',
  field_edit: 'Edited',
}

const TX_COLORS: Record<string, string> = {
  receipt: 'bg-[#e7f5ef] text-[#0b6644]',
  sale: 'bg-[#eaf0fb] text-[#1f4b99]',
  transfer_out: 'bg-[#fdf3e7] text-[#8a4b06]',
  transfer_in: 'bg-[#e3f4f2] text-[#0f7566]',
  adjustment: 'bg-[#f1ebfb] text-[#3f1490]',
  return: 'bg-[#fdf0e5] text-[#b25e09]',
  write_off: 'bg-[#fdeceb] text-[#b42318]',
  field_edit: 'bg-[#f1f1f4] text-[#5b5b6b]',
}

function humanizeField(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim()
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

const LEDGER_GRID = 'grid grid-cols-[100px_170px_110px_minmax(0,1fr)_70px] gap-x-3 items-center'

/** Only a receipt ('goods_receipt', an "RR-" code) has a real single-record
 * detail page in the app today — stock_transfer/stock_adjustment/etc.
 * resolve to a human-readable code too, but there's no [id] route for them
 * to land on, so those stay plain text rather than link to a page that
 * doesn't exist. */
function sourceHref(entry: ItemLedgerEntry): string | null {
  if (entry.referenceType === 'goods_receipt' && entry.referenceId) {
    return `/inventory/stock/reports/${entry.referenceId}`
  }
  return null
}

type Props = {
  itemId: string
  locations?: string[]
}

export default function MovementsTab({ itemId, locations }: Props) {
  const {
    currentBalances,
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
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    resetFilters,
  } = useItemLedger(itemId, locations)

  const hasFilters = !!warehouseId || !!transactionType || !!startDate || !!endDate
  const totalPages = meta?.lastPage ?? 1
  const total = meta?.total ?? 0

  return (
    <div className={`${PLEX} flex flex-col gap-4 p-5`}>
      {/* Current stock summary */}
      {currentBalances.length > 0 && (
        <div className="space-y-1">
          <p
            className={`${MONO} text-[10.5px] font-semibold tracking-[.08em] text-[#8b8b9b] uppercase`}
          >
            Current Stock
          </p>
          <div className="flex flex-wrap gap-2">
            {currentBalances.map((b, i) => {
              const isActive = !!b.warehouse?.id && warehouseId === b.warehouse.id
              return (
                <button
                  key={i}
                  type="button"
                  data-testid="movements-location-pill"
                  onClick={() => setWarehouseId(isActive ? undefined : b.warehouse?.id)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] transition-colors ${
                    isActive
                      ? 'border-[#5b21b6] bg-[#f1ebfb]'
                      : 'border-[#e4e4e9] bg-[#fbfbfc] hover:border-[#d3d3db]'
                  }`}
                >
                  <span className={`font-medium ${isActive ? 'text-[#3f1490]' : 'text-[#3d3d4a]'}`}>
                    {b.warehouse?.branch?.name ??
                      b.warehouse?.name ??
                      b.warehouse?.code ??
                      'Unknown'}
                  </span>
                  <span className="text-[#a3a3b2]">·</span>
                  <span className={`${MONO} font-semibold text-[#17171c]`}>{b.availableQty}</span>
                  <span className="text-[#a3a3b2]">avail</span>
                  {b.reservedQty > 0 && (
                    <span className="text-[#a3a3b2]">· {b.reservedQty} reserved</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Filters — location is filtered by clicking a Current Stock pill
          above, not a dropdown here. */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={transactionType ?? ''}
          onChange={(e) => setTransactionType(e.target.value || undefined)}
          className="rounded-lg border border-[#d3d3db] bg-white px-2.5 py-1.5 text-[12px] text-[#3d3d4a] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]"
        >
          {TRANSACTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <label htmlFor="movements-start-date" className="sr-only">
          From date
        </label>
        <input
          id="movements-start-date"
          type="date"
          value={startDate ?? ''}
          onChange={(e) => setStartDate(e.target.value || undefined)}
          className="rounded-lg border border-[#d3d3db] bg-white px-2.5 py-1.5 text-[12px] text-[#3d3d4a] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]"
        />
        <span className="text-[12px] text-[#8b8b9b]">to</span>
        <label htmlFor="movements-end-date" className="sr-only">
          To date
        </label>
        <input
          id="movements-end-date"
          type="date"
          value={endDate ?? ''}
          onChange={(e) => setEndDate(e.target.value || undefined)}
          className="rounded-lg border border-[#d3d3db] bg-white px-2.5 py-1.5 text-[12px] text-[#3d3d4a] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]"
        />

        {hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] text-[#5b21b6] hover:bg-[#f1ebfb]"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}

        {isFetching && !isLoading && (
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#a3a3b2]" />
        )}
      </div>

      {/* Ledger entries */}
      <div
        className={`overflow-hidden rounded-xl border border-[#e4e4e9] bg-white transition-opacity ${isFetching ? 'opacity-60' : ''}`}
      >
        {isLoading ? (
          <div className="divide-y divide-[#f4f4f6]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`${LEDGER_GRID} px-4 py-3`}>
                <div className="h-4 w-16 animate-pulse rounded bg-[#eeeef1]" />
                <div className="h-4 w-24 animate-pulse rounded bg-[#eeeef1]" />
                <div className="h-5 w-16 animate-pulse rounded-[5px] bg-[#eeeef1]" />
                <div className="h-4 w-28 animate-pulse rounded bg-[#eeeef1]" />
                <div className="ml-auto h-4 w-8 animate-pulse rounded bg-[#eeeef1]" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="mb-3 h-8 w-8 text-[#c9c9d3]" />
            <p className="text-[13px] font-medium text-[#5b5b6b]">No movements found</p>
            <p className="mt-1 text-[12px] text-[#8b8b9b]">Try adjusting the filters above.</p>
          </div>
        ) : (
          <div role="table" aria-label="Stock movements">
            <div
              role="row"
              className={`${LEDGER_GRID} ${MONO} border-b border-[#eeeef1] bg-[#fbfbfc] px-4 py-[9px] text-[10px] tracking-[.08em] text-[#8b8b9b] uppercase`}
            >
              <span role="columnheader">Date</span>
              <span role="columnheader">Reference</span>
              <span role="columnheader">Type</span>
              <span role="columnheader">Location</span>
              <span role="columnheader" className="text-right">
                Qty
              </span>
            </div>

            <div className="divide-y divide-[#f4f4f6]">
              {entries.map((entry) => {
                const colorClass = TX_COLORS[entry.transactionType] ?? 'bg-[#f1f1f4] text-[#5b5b6b]'
                const label = TX_LABELS[entry.transactionType] ?? entry.transactionType
                const isFieldEdit = entry.transactionType === 'field_edit'
                const hasIn = entry.quantityIn > 0
                const hasOut = entry.quantityOut > 0
                const location = entry.warehouse
                  ? (entry.warehouse.branch?.name ??
                    [entry.warehouse.code, entry.warehouse.name].filter(Boolean).join(' · '))
                  : null

                return (
                  <div
                    key={entry.id}
                    role="row"
                    className={`${LEDGER_GRID} px-4 py-3 hover:bg-[#fcfcfd]`}
                  >
                    <span role="cell" className="text-[12px] text-[#5b5b6b]">
                      {new Date(entry.occurredAt).toLocaleDateString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>

                    <span role="cell" className="min-w-0 truncate">
                      {entry.referenceCode ? (
                        sourceHref(entry) ? (
                          <a
                            href={sourceHref(entry)!}
                            onClick={(e) => e.stopPropagation()}
                            className={`${MONO} text-[11.5px] text-[#1f4b99] underline decoration-transparent underline-offset-2 hover:decoration-current`}
                          >
                            {entry.referenceCode}
                          </a>
                        ) : (
                          <span className={`${MONO} text-[11.5px] text-[#3d3d4a]`}>
                            {entry.referenceCode}
                          </span>
                        )
                      ) : (
                        <span className="text-[#a3a3b2]">—</span>
                      )}
                    </span>

                    <span role="cell">
                      <span
                        className={`inline-flex shrink-0 rounded-[5px] px-2 py-0.5 text-[11px] font-semibold ${colorClass}`}
                      >
                        {label}
                      </span>
                    </span>

                    <span role="cell" className="min-w-0 truncate text-[12px] text-[#3d3d4a]">
                      {isFieldEdit ? (
                        <>
                          {humanizeField(entry.field ?? '')}:{' '}
                          <span className="text-[#a3a3b2] line-through">
                            {entry.oldValue ?? '—'}
                          </span>{' '}
                          <span className="text-[#c9c9d3]">→</span>{' '}
                          <span className="font-medium">{entry.newValue ?? '—'}</span>
                        </>
                      ) : (
                        (location ?? '—')
                      )}
                      {!isFieldEdit && entry.notes && (
                        <span className="ml-1.5 text-[#a3a3b2] italic">{entry.notes}</span>
                      )}
                    </span>

                    <span role="cell" className={`${MONO} text-right text-[13px] font-bold`}>
                      {isFieldEdit ? (
                        <span className="text-[#a3a3b2]">—</span>
                      ) : hasIn ? (
                        <span className="text-[#0b6644]">+{entry.quantityIn}</span>
                      ) : hasOut ? (
                        <span className="text-[#b42318]">−{entry.quantityOut}</span>
                      ) : (
                        <span className="text-[#5b5b6b]">0</span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[12px] text-[#8b8b9b]">
          <span>
            {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded-lg px-2.5 py-1 hover:bg-[#f1f1f4] disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-2 font-medium text-[#3d3d4a]">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="rounded-lg px-2.5 py-1 hover:bg-[#f1f1f4] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
