'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, X, RefreshCw, BookOpen, ArrowUpRight, ArrowDownRight, Plus } from 'lucide-react'
import { useStockLedger } from '../_hooks/useStockLedger'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import NewAdjustmentModal from './NewAdjustmentModal'
import Tooltip from '@/src/components/ui/Tooltip'
import { PLEX, MONO } from '../../purchase-orders/_components/procurementTokens'
import type { LocationToken } from '@/src/libs/inventory/location-tokens'
import type { StockLedgerEntry } from '@/src/schema/inventory/goods-receiving'

// ─── Design tokens ────────────────────────────────────────────────────────────
// Follows Stock Balance's own #5b21b6 palette (PLEX/MONO imported
// from procurementTokens, shared across the Inventory module's operational
// screens) so the two tabs read as one system rather than Balance's polish
// stopping at the tab boundary.

const CONTROL_CHROME = {
  idle: 'border-[#d3d3db]',
  focused: 'border-[#5b21b6] shadow-[0_0_0_3px_#f0e9fc]',
}

const TX_META: Record<string, { label: string; badge: string }> = {
  receipt: { label: 'Goods Receipt', badge: 'bg-[#e7f5ef] text-[#0b6644]' },
  sale: { label: 'Sale', badge: 'bg-[#eaf0fb] text-[#1f4b99]' },
  transfer_out: { label: 'Transfer Out', badge: 'bg-[#fdf3e7] text-[#8a4b06]' },
  transfer_in: { label: 'Transfer In', badge: 'bg-[#e3f6f6] text-[#0e6e6e]' },
  adjustment: { label: 'Adjustment', badge: 'bg-[#f1ebfb] text-[#3f1490]' },
  return: { label: 'Return', badge: 'bg-[#fdeaf0] text-[#9d174d]' },
  write_off: { label: 'Write-off', badge: 'bg-[#fdeceb] text-[#b42318]' },
  supplier_return: { label: 'Supplier Return', badge: 'bg-[#eceef5] text-[#3d4a7a]' },
  // The replacement unit leaving on an exchange. Named for what the clerk did
  // rather than the enum: an unmapped type fell through to the raw
  // `exchange_out`, which is the one row on this ledger nobody could read.
  exchange_out: { label: 'Exchange Out', badge: 'bg-[#e8e9fb] text-[#312e81]' },
}

const TRANSACTION_TYPE_OPTIONS = [
  { value: 'receipt', label: 'Goods Receipt' },
  { value: 'sale', label: 'Sale' },
  { value: 'transfer_out', label: 'Transfer Out' },
  { value: 'transfer_in', label: 'Transfer In' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'return', label: 'Return' },
  { value: 'write_off', label: 'Write-off' },
  { value: 'supplier_return', label: 'Supplier Return' },
  { value: 'exchange_out', label: 'Exchange Out' },
]

function TxBadge({ type }: { type: string }) {
  const meta = TX_META[type] ?? { label: type, badge: 'bg-[#f1f1f4] text-[#3d3d4a]' }
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-[5px] px-[9px] py-[3px] text-[13.5px] font-medium ${meta.badge}`}
    >
      {meta.label}
    </span>
  )
}

/** RR / PO / supplier / SI / DR stacked in one column rather than five — the
 * ledger is already wide, and these are read together as "where did this
 * come from" or not at all. */
function SourceCell({ entry }: { entry: StockLedgerEntry }) {
  const hasSource =
    entry.receivingReportCode ||
    entry.purchaseOrderNumber ||
    entry.supplier?.name ||
    entry.supplierInvoiceNumber ||
    entry.deliveryReceiptNumber ||
    entry.stockTransferNumber ||
    entry.supplierDebitMemoNumber

  if (!hasSource) return <span className="text-[#c9c9d3]">—</span>

  // min-w-0 on the flex column — without it a nowrap/truncate child can't
  // shrink below its own text width inside a flex container, so a long
  // supplier name would blow out the fixed-width column instead of eliding.
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {entry.stockTransferNumber && (
        <>
          <Link
            href="/inventory/transfers"
            className={`${MONO} truncate text-[13.5px] text-[#3d3d4a] hover:text-[#5b21b6] hover:underline`}
            title="Stock transfer"
          >
            {entry.stockTransferNumber}
          </Link>
          {entry.transferWarehouse && (
            <p className="truncate text-[13px] text-[#8b8b9b]">
              {entry.transactionType === 'transfer_out' ? 'to ' : 'from '}
              {entry.transferWarehouse.branch?.name ?? entry.transferWarehouse.name}
            </p>
          )}
        </>
      )}
      {entry.supplierDebitMemoNumber && (
        <p className={`${MONO} truncate text-[13px] text-[#a3a3b2]`} title="Supplier debit memo">
          DM {entry.supplierDebitMemoNumber}
        </p>
      )}
      {entry.receivingReportCode &&
        (entry.receivingReportId ? (
          <Link
            href={`/inventory/stock/reports/${entry.receivingReportId}`}
            className={`${MONO} truncate text-[13.5px] text-[#3d3d4a] hover:text-[#5b21b6] hover:underline`}
            title="Receiving report"
          >
            {entry.receivingReportCode}
          </Link>
        ) : (
          <p className={`${MONO} truncate text-[13.5px] text-[#3d3d4a]`} title="Receiving report">
            {entry.receivingReportCode}
          </p>
        ))}
      {entry.purchaseOrderNumber && (
        <Link
          href={
            entry.purchaseOrderId
              ? `/inventory/purchase-orders?tab=orders&po=${entry.purchaseOrderId}`
              : '/inventory/purchase-orders?tab=orders'
          }
          className={`${MONO} truncate text-[13px] text-[#8b8b9b] hover:text-[#5b21b6] hover:underline`}
          title="Purchase order"
        >
          {entry.purchaseOrderNumber}
        </Link>
      )}
      {entry.supplier?.name && (
        <p className="truncate text-[13px] text-[#8b8b9b]" title={entry.supplier.name}>
          {entry.supplier.name}
        </p>
      )}
      {entry.supplierInvoiceNumber && (
        <p className={`${MONO} truncate text-[13px] text-[#a3a3b2]`} title="Supplier invoice">
          SI {entry.supplierInvoiceNumber}
        </p>
      )}
      {entry.deliveryReceiptNumber && (
        <p
          className={`${MONO} truncate text-[13px] text-[#a3a3b2]`}
          title="Supplier's delivery receipt"
        >
          DR {entry.deliveryReceiptNumber}
        </p>
      )}
    </div>
  )
}

function SkeletonBar({ wide }: { wide?: boolean }) {
  return (
    <span
      className={`block animate-pulse rounded-[3px] bg-[#eeeef1] ${
        wide ? 'h-[18px] w-[70px] rounded-[5px]' : 'h-[10px]'
      }`}
    />
  )
}

export default function StockLedgerTab({
  initialLocations,
  canAdjust = false,
}: {
  /** The Stock Balance tab's location filter at the moment this tab is
   * opened, so a branch picked there carries over here instead of Ledger
   * silently showing every branch. */
  initialLocations?: LocationToken[]
  /** Scenario 56 — shows "New adjustment" (inventory:stock:adjust). */
  canAdjust?: boolean
} = {}) {
  const [searchFocus, setSearchFocus] = useState(false)
  const [isAdjustOpen, setIsAdjustOpen] = useState(false)
  const {
    entries,
    total,
    page,
    limit,
    totalPages,
    isLoading,
    isFetching,
    error,
    refetch,
    warehouseId,
    transactionType,
    startDate,
    endDate,
    search,
    setSearch,
    setWarehouseId,
    setTransactionType,
    setStartDate,
    setEndDate,
    resetFilters,
    setPage,
    setLimit,
    warehouseOptions,
    warehousesLoading,
  } = useStockLedger(initialLocations)

  const activeFilterCount = [!!warehouseId, !!transactionType, !!startDate || !!endDate].filter(
    Boolean
  ).length
  const hasFilters = activeFilterCount > 0 || !!search

  const locationOptions = warehouseOptions.map((wh) => ({
    value: wh.id,
    label: wh.branch?.name ?? wh.name,
  }))

  const isNoResults = !isLoading && entries.length === 0

  return (
    <div className={`${PLEX} flex flex-col gap-[14px] text-[#17171c] antialiased`}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[21px] font-semibold tracking-[-0.015em]">Stock Ledger</h1>
          <p className="text-[13px] text-[#5b5b6b]">
            Every stock movement — receipts, sales, transfers, adjustments and returns — in one
            timeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canAdjust && (
            <button
              type="button"
              onClick={() => setIsAdjustOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-3 py-[9px] text-[13px] font-medium text-white hover:bg-[#4a189b]"
            >
              <Plus className="h-3.5 w-3.5" />
              New adjustment
            </button>
          )}
          <Tooltip label="Refresh">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Refresh"
              className="flex items-center gap-2 rounded-lg border border-[#d3d3db] bg-white px-3 py-[9px] text-[13px] font-medium text-[#5b21b6] hover:bg-[#f1ebfb] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </Tooltip>
        </div>
      </div>

      <NewAdjustmentModal open={isAdjustOpen} onClose={() => setIsAdjustOpen(false)} />

      {/* Error */}
      {!!error && (
        <div className="rounded-[9px] border border-[#f3c9c5] bg-[#fdeceb] px-[14px] py-[10px]">
          <p className="text-[12.5px] font-medium text-[#b42318]">
            Failed to load the stock ledger
          </p>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-[10px] rounded-xl border border-[#e4e4e9] bg-white p-3">
        {/* Scenario 50 — unit (serial), model, RR, ST, SI, or DR. Resolved
            server-side (including across a couple of soft FKs), so it
            searches the whole ledger rather than the page on screen. */}
        <div
          className={`flex h-[38px] min-w-[220px] flex-[1_1_300px] items-center gap-[9px] rounded-lg border px-3 transition-colors ${
            searchFocus ? CONTROL_CHROME.focused : CONTROL_CHROME.idle
          }`}
        >
          <Search className="h-3.25 w-3.25 shrink-0 text-[#8b8b9b]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocus(true)}
            onBlur={() => setSearchFocus(false)}
            placeholder="Search unit, model, RR, ST, SI, or DR no.…"
            className="min-w-0 flex-1 border-none bg-transparent p-0 text-[13px] text-[#17171c] outline-none placeholder:text-[#a3a3b2]"
          />
          {search !== '' && (
            <Tooltip label="Clear search" side="bottom" align="end">
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[#8b8b9b] hover:bg-[#f1f1f4] hover:text-[#3d3d4a]"
              >
                <X className="h-3 w-3" />
              </button>
            </Tooltip>
          )}
        </div>

        <SearchableSelect
          className="w-[190px]"
          value={warehouseId ?? ''}
          onChange={(v) => setWarehouseId(v || undefined)}
          placeholder="All Locations"
          loading={warehousesLoading}
          chrome={CONTROL_CHROME}
          clearable
          options={locationOptions}
        />

        <SearchableSelect
          className="w-[190px]"
          value={transactionType ?? ''}
          onChange={(v) => setTransactionType(v || undefined)}
          placeholder="All Types"
          chrome={CONTROL_CHROME}
          clearable
          options={TRANSACTION_TYPE_OPTIONS}
        />

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate ?? ''}
            onChange={(e) => setStartDate(e.target.value || undefined)}
            className={`rounded-lg border bg-white px-3 py-[8px] text-[13px] text-[#17171c] outline-none transition-colors ${CONTROL_CHROME.idle} focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]`}
          />
          <span className="text-[12px] text-[#a3a3b2]">–</span>
          <input
            type="date"
            value={endDate ?? ''}
            onChange={(e) => setEndDate(e.target.value || undefined)}
            className={`rounded-lg border bg-white px-3 py-[8px] text-[13px] text-[#17171c] outline-none transition-colors ${CONTROL_CHROME.idle} focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]`}
          />
        </div>

        {isFetching && !isLoading && (
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#a3a3b2]" />
        )}

        {hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-[11px] py-[6px] text-[12.5px] text-[#5b21b6] hover:bg-[#f1ebfb]"
          >
            <X className="h-3.5 w-3.5" />
            Clear {activeFilterCount > 0 ? activeFilterCount : ''}{' '}
            {activeFilterCount === 1 ? 'filter' : 'filters'}
          </button>
        )}
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-xl border border-[#e4e4e9] bg-white">
        {isLoading ? (
          <div>
            <div
              className={`${MONO} hidden border-b border-[#eeeef1] bg-[#fbfbfc] px-4 py-[9px] text-[10px] uppercase tracking-[.09em] text-[#8b8b9b] sm:flex sm:gap-4`}
            >
              <span className="w-20">Type</span>
              <span className="flex-1">Item</span>
              <span className="w-32">Location</span>
              <span className="w-40">Source</span>
              <span className="w-16 text-center">Qty</span>
              <span className="w-28">Date</span>
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-t border-[#f4f4f6] px-4 py-[14px] first:border-t-0"
              >
                <SkeletonBar wide />
                <SkeletonBar />
                <div className="ml-auto h-4 w-12">
                  <SkeletonBar wide />
                </div>
              </div>
            ))}
          </div>
        ) : isNoResults ? (
          hasFilters ? (
            <div className="flex flex-col items-center gap-2 px-6 py-11 text-center">
              <BookOpen className="h-[30px] w-[30px] text-[#c9c9d3]" />
              <div className="mt-1 text-[14px] font-semibold">No movements match</div>
              <div className="max-w-[420px] text-[12.5px] leading-[1.55] text-[#5b5b6b]">
                {search
                  ? `Nothing matches "${search}". Try a different reference, or clear a filter to widen the search.`
                  : 'No movements fall inside these filters. Clear one to see more of the ledger.'}
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-3 rounded-lg border border-[#d3d3db] bg-white px-[15px] py-[9px] text-[13px] font-medium text-[#17171c] hover:border-[#a3a3b2]"
              >
                Clear search and filters
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-13 text-center">
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-[#ddd0f7] bg-[#f1ebfb]">
                <BookOpen className="h-4 w-4 text-[#5b21b6]" />
              </div>
              <div className="mt-1 text-[15px] font-semibold">No movements recorded yet</div>
              <div className="max-w-[440px] text-[12.5px] leading-[1.55] text-[#5b5b6b]">
                Every receipt, sale, transfer, adjustment or return posts here the moment it happens
                — this fills in as stock starts moving.
              </div>
            </div>
          )
        ) : (
          <>
            <div className={`overflow-x-auto transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
              <table className="w-full table-fixed text-left text-sm">
                <thead>
                  <tr
                    className={`${MONO} border-b border-[#eeeef1] bg-[#fbfbfc] text-[12px] uppercase tracking-[.09em] text-[#8b8b9b]`}
                  >
                    <th className="w-[120px] px-4 py-[9px] font-medium">Type</th>
                    <th className="w-[320px] px-4 py-[9px] font-medium">Item</th>
                    <th className="hidden w-[150px] px-4 py-[9px] font-medium sm:table-cell">
                      Location
                    </th>
                    {/* Scenario 50 Gap 4 — RR, PO, supplier, SI and DR
                        stacked in one column rather than five. */}
                    <th className="hidden w-[190px] px-4 py-[9px] font-medium lg:table-cell">
                      Source
                    </th>
                    <th className="w-[84px] px-4 py-[9px] text-center font-medium">Qty</th>
                    <th className="hidden w-[130px] px-4 py-[9px] font-medium md:table-cell">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4f4f6]">
                  {entries.map((entry) => {
                    const date = entry.occurredAt ?? entry.createdAt
                    // `quantity` is absolute, so the direction has to come
                    // off the signed value. Older payloads that carry only
                    // `quantity` fall back to reading as an inflow.
                    const signed = entry.quantityChange ?? entry.quantity
                    const positive = signed >= 0
                    return (
                      <tr key={entry.id} className="hover:bg-[#fcfcfd]">
                        <td className="overflow-hidden px-4 py-[11px]">
                          <TxBadge type={entry.transactionType} />
                        </td>
                        <td className="px-4 py-[11px]">
                          <p className="break-words text-[14.5px] font-medium text-[#17171c]">
                            {entry.item?.name ?? '—'}
                          </p>
                          {entry.item?.sku && (
                            <p className={`${MONO} truncate text-[13px] text-[#a3a3b2]`}>
                              {entry.item.sku}
                            </p>
                          )}
                          {entry.serialNumber && (
                            <p
                              className={`${MONO} truncate text-[13px] text-[#8b8b9b]`}
                              title="Serial number"
                            >
                              SN {entry.serialNumber}
                            </p>
                          )}
                        </td>
                        <td className="hidden overflow-hidden truncate px-4 py-[11px] text-[14.5px] text-[#5b5b6b] sm:table-cell">
                          {entry.warehouse?.branch?.name ?? entry.warehouse?.name ?? '—'}
                        </td>
                        <td className="hidden overflow-hidden px-4 py-[11px] lg:table-cell">
                          <SourceCell entry={entry} />
                        </td>
                        <td className="px-4 py-[11px]">
                          <span
                            className={`${MONO} inline-flex items-center gap-0.5 justify-center whitespace-nowrap text-[15px] font-semibold ${
                              positive ? 'text-[#0b6644]' : 'text-[#b42318]'
                            }`}
                          >
                            {positive ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3" />
                            )}
                            {positive ? `+${Math.abs(signed)}` : `-${Math.abs(signed)}`}
                          </span>
                        </td>
                        <td
                          className={`${MONO} hidden px-4 py-[11px] text-[13.5px] text-[#8b8b9b] md:table-cell`}
                        >
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
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-[14px] border-t border-[#e4e4e9] bg-[#fbfbfc] px-4 py-[11px]">
              <span className="text-[11.5px] text-[#8b8b9b]">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of{' '}
                {total.toLocaleString()} movements
              </span>
              <div className="flex items-center gap-[10px]">
                <span className="text-[11.5px] text-[#8b8b9b]">Rows</span>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="rounded-[7px] border border-[#d3d3db] bg-white px-[9px] py-1.5 text-[12px] text-[#3d3d4a]"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="rounded-[7px] border border-[#e4e4e9] bg-white px-[11px] py-1.5 text-[12px] text-[#17171c] disabled:text-[#a3a3b2]"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="rounded-[7px] border border-[#d3d3db] bg-white px-[11px] py-1.5 text-[12px] text-[#17171c] hover:border-[#a3a3b2] disabled:text-[#a3a3b2]"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
