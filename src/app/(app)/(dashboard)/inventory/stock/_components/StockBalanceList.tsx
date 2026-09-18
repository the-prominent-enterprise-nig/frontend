'use client'

import { useState } from 'react'
import { RefreshCw, Search, AlertTriangle, Package, X } from 'lucide-react'
import { useStockBalance } from '../_hooks/useStockBalance'
import { useUIShell } from '@/src/stores/ui-shell.store'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import CategorySelect from '@/src/components/ui/CategorySelect'
import Tooltip from '@/src/components/ui/Tooltip'
import { PLEX, MONO } from '../../purchase-orders/_components/procurementTokens'
import type { StockBalance, StockStateFilter } from '@/src/schema/inventory/goods-receiving'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { LocationToken } from '@/src/libs/inventory/location-tokens'

// ─── Design tokens ────────────────────────────────────────────────────────────
// This screen follows the Purchase Orders / Receiving Reports design's own
// #5b21b6 palette (PLEX/MONO imported from procurementTokens, shared across
// the Inventory module's operational screens) — the same choice already made
// for procurement. The page ground stays zinc-50 so it sits on the same
// background as the rest of the dashboard shell.

/** Scenario 50 — the client reads an item as brand + model ("Sharp SJML70").
 * Falls back through model-only and then the item's own name so a row is
 * never blank for an item whose catalogue record is incomplete. */
function itemTitle(
  item?: {
    name: string
    modelNumber?: string | null
    brand?: { name: string } | null
  } | null
): string {
  if (!item) return '—'
  const parts = [item.brand?.name, item.modelNumber].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : item.name
}

// Matches the label map already used on the price list screens.
const REGION_OPTIONS = [
  { value: 'panay', label: 'Panay' },
  { value: 'negros', label: 'Negros' },
]

// The five states the filter offers. The first four are exactly the badge the
// rows already render (STOCK_STATUS_META below) — the server derives them with
// `deriveStockState`, mirroring `stockStatusOf` here, and applies the filter
// after the item roll-up so the filter and the visible badge can never
// disagree. `in_transit` is a different axis: units on an open transfer,
// counted off transfer lines rather than the balance row's own quantities, so
// a row can be both In Stock and have units in transit.
//
// Deliberately no In Transit column: rows roll up per item across locations, so
// a single qty there would flatten "3 in transit to Bago, 2 to Ajuy" into an
// unattributed 5.
const STOCK_STATE_OPTIONS = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'low', label: 'Low Stock' },
  { value: 'fully_reserved', label: 'Fully Reserved' },
  { value: 'out', label: 'Out of Stock' },
  { value: 'in_transit', label: 'In Transit' },
]

const CONTROL_CHROME = {
  idle: 'border-[#d3d3db]',
  focused: 'border-[#5b21b6] shadow-[0_0_0_3px_#f0e9fc]',
}

type StockStatus = 'out' | 'fully_reserved' | 'low' | 'in_stock'

const STOCK_STATUS_META: Record<StockStatus, { label: string; badge: string; dot: string }> = {
  out: { label: 'Out of Stock', badge: 'bg-[#fdeceb] text-[#b42318]', dot: 'bg-[#d9544c]' },
  fully_reserved: {
    label: 'Fully Reserved',
    badge: 'bg-[#eaf0fb] text-[#1f4b99]',
    dot: 'bg-[#3b74cc]',
  },
  low: { label: 'Low Stock', badge: 'bg-[#fdf3e7] text-[#8a4b06]', dot: 'bg-[#d18b1d]' },
  in_stock: { label: 'In Stock', badge: 'bg-[#e7f5ef] text-[#0b6644]', dot: 'bg-[#0f7b52]' },
}

/** Out of Stock (nothing physically on hand) and Fully Reserved (stock exists
 * but every unit is already committed) used to collapse into one red badge —
 * `availableQty <= 0` was true for both, so a row with 40 on hand and 40
 * reserved read identically to a genuinely empty shelf. */
function stockStatusOf(bal: StockBalance): StockStatus {
  if (bal.onHandQty <= 0) return 'out'
  if (bal.availableQty <= 0) return 'fully_reserved'
  if (bal.reorderPoint != null && bal.availableQty < bal.reorderPoint) return 'low'
  return 'in_stock'
}

const AVAILABLE_TEXT: Record<StockStatus, string> = {
  out: 'text-[#b42318]',
  fully_reserved: 'text-[#1f4b99]',
  low: 'text-[#8a4b06]',
  in_stock: 'text-[#0b6644]',
}

/** The seven-column track the header, rows and skeletons all share — same
 * `role="table"`/CSS-grid approach as Purchase Orders, since assistive tech
 * and this module's e2e specs both lean on the explicit table semantics. */
const GRID = 'grid grid-cols-[minmax(0,1fr)_128px_84px_68px_84px_96px_118px] gap-x-3 items-center'

function StockStatusBadge({ status }: { status: StockStatus }) {
  const meta = STOCK_STATUS_META[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] px-[9px] py-[3px] text-[11.5px] font-medium ${meta.badge}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
      {status === 'low' && <AlertTriangle className="h-3 w-3" />}
      {meta.label}
    </span>
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

export default function StockBalanceList({
  session: _session,
  onLocationsChange,
}: {
  session: SessionUser
  /** Lets StockHub snapshot the current location filter so the Ledger tab
   * can inherit it when it's opened next. */
  onLocationsChange?: (v: LocationToken[]) => void
}) {
  const { pushPanel } = useUIShell()
  const [searchFocus, setSearchFocus] = useState(false)

  const {
    balances,
    summary,
    pagination,
    isLoading,
    isFetching,
    error,
    locations,
    region,
    search,
    categoryId,
    stockStatus,
    setLocations,
    setRegion,
    setSearch,
    setCategoryId,
    setStockStatus,
    resetFilters,
    page,
    setPage,
    limit,
    setLimit,
    locationOptions,
    locationsLoading,
    categoryOptions,
    refetch,
  } = useStockBalance(onLocationsChange)

  const activeFilterCount = [locations.length > 0, !!region, !!categoryId, !!stockStatus].filter(
    Boolean
  ).length
  const hasFilters = activeFilterCount > 0 || !!search

  const openDrawer = (bal: StockBalance) => {
    if (!bal.item?.id) return
    pushPanel({
      type: 'item360',
      itemId: bal.item.id,
      itemName: itemTitle(bal.item),
      context: 'stock',
      // The drawer is the per-location breakdown of this rolled-up row, so
      // it must break down the same locations the row was summed from.
      locations,
    })
  }

  const showTable = !isLoading && balances.length > 0
  const isNoResults = !isLoading && balances.length === 0

  return (
    <div className={`${PLEX} min-h-screen bg-zinc-50 text-[#17171c] antialiased`}>
      <div className="mx-auto flex max-w-[1560px] flex-col gap-[14px] p-[14px] min-[1080px]:px-5 min-[1080px]:py-[22px]">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-[21px] font-semibold tracking-[-0.015em]">Stock Balance</h1>
            <p className="text-[13px] text-[#5b5b6b]">
              One row per item — on-hand, sold, reserved and available, rolled up across every
              selected location.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-lg border border-[#d3d3db] bg-white px-3 py-[9px] text-[13px] font-medium text-[#5b21b6] hover:bg-[#f1ebfb] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-[9px] border border-[#f3c9c5] bg-[#fdeceb] px-[14px] py-[10px]">
            <p className="text-[12.5px] font-medium text-[#b42318]">
              Failed to load stock balances
            </p>
          </div>
        )}

        {/* Metric band */}
        {!isLoading && (
          <div className="grid grid-cols-2 divide-x divide-y divide-[#eeeef1] overflow-hidden rounded-xl border border-[#e4e4e9] bg-white min-[640px]:grid-cols-3 min-[1080px]:grid-cols-5 min-[1080px]:divide-y-0">
            <div className="flex flex-col gap-1 px-4 py-3">
              <span className={`${MONO} text-[10px] uppercase tracking-[.08em] text-[#8b8b9b]`}>
                Items
              </span>
              <span className={`${MONO} text-[20px] font-semibold tracking-[-.01em]`}>
                {pagination.total.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col gap-1 px-4 py-3">
              <span className={`${MONO} text-[10px] uppercase tracking-[.08em] text-[#8b8b9b]`}>
                On hand
              </span>
              <span className={`${MONO} text-[20px] font-semibold tracking-[-.01em]`}>
                {(summary?.totalOnHandQty ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col gap-1 px-4 py-3">
              <span className={`${MONO} text-[10px] uppercase tracking-[.08em] text-[#8b8b9b]`}>
                Reserved
              </span>
              <span
                className={`${MONO} text-[20px] font-semibold tracking-[-.01em] ${
                  (summary?.totalReservedQty ?? 0) > 0 ? 'text-[#8a4b06]' : 'text-[#17171c]'
                }`}
              >
                {(summary?.totalReservedQty ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col gap-1 bg-[#f4fbf7] px-4 py-3">
              <span className={`${MONO} text-[10px] uppercase tracking-[.08em] text-[#8b8b9b]`}>
                Available
              </span>
              <span
                className={`${MONO} text-[20px] font-semibold tracking-[-.01em] text-[#0b6644]`}
              >
                {(summary?.totalAvailableQty ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col gap-1 px-4 py-3">
              <span className={`${MONO} text-[10px] uppercase tracking-[.08em] text-[#8b8b9b]`}>
                Sold
              </span>
              <span className={`${MONO} text-[20px] font-semibold tracking-[-.01em]`}>
                {(summary?.totalSoldQty ?? 0).toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-[10px] rounded-xl border border-[#e4e4e9] bg-white p-3">
          {/* Search — brand, model or category only. Serial numbers were
              deliberately dropped: a serial belongs to one unit, not to the
              rolled-up quantity this list reports. */}
          <div
            className={`flex h-[38px] min-w-[220px] flex-[1_1_280px] items-center gap-[9px] rounded-lg border px-3 transition-colors ${
              searchFocus ? CONTROL_CHROME.focused : CONTROL_CHROME.idle
            }`}
          >
            <Search className="h-3.25 w-3.25 shrink-0 text-[#8b8b9b]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
              placeholder="Search brand, model, or category…"
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

          {/* Operations — the client's name for region. */}
          <SearchableSelect
            className="w-[168px]"
            value={region ?? ''}
            onChange={(v) => setRegion((v || undefined) as 'panay' | 'negros' | undefined)}
            placeholder="All Operations"
            chrome={CONTROL_CHROME}
            clearable
            options={REGION_OPTIONS}
          />

          {/* Branches — multi-select across branches and the 2 standalone
              warehouses. */}
          <SearchableSelect
            multiple
            className="w-[220px]"
            value={locations}
            onChange={setLocations}
            placeholder="All Branches"
            summaryNoun="branches"
            loading={locationsLoading}
            chrome={CONTROL_CHROME}
            clearable
            options={locationOptions}
          />

          <CategorySelect
            className="w-[200px]"
            value={categoryId}
            onChange={setCategoryId}
            options={categoryOptions}
            placeholder="All Categories"
          />

          {/* Stock state — settled stock vs units still on an open transfer. */}
          <SearchableSelect
            className="w-[170px]"
            value={stockStatus ?? ''}
            onChange={(v) => setStockStatus((v || undefined) as StockStateFilter | undefined)}
            placeholder="All Stock"
            chrome={CONTROL_CHROME}
            clearable
            options={STOCK_STATE_OPTIONS}
          />

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
          {/* Wide: CSS-grid table, same approach as Purchase Orders — explicit
              role="table"/"row"/"cell" since the markup isn't a <table>. */}
          {showTable && (
            <div role="table" aria-label="Stock balance" className="hidden min-[1080px]:block">
              <div
                role="row"
                className={`${GRID} ${MONO} border-b border-[#eeeef1] bg-[#fbfbfc] px-4 py-[9px] text-[10px] uppercase tracking-[.09em] text-[#8b8b9b]`}
              >
                <span role="columnheader">Item</span>
                <span role="columnheader">Category</span>
                <span role="columnheader" className="text-right">
                  On Hand
                </span>
                <span role="columnheader" className="text-right">
                  Sold
                </span>
                <span role="columnheader" className="text-right">
                  Reserved
                </span>
                <span role="columnheader" className="text-right">
                  Available
                </span>
                <span role="columnheader" className="text-center">
                  Status
                </span>
              </div>

              {balances.map((bal) => {
                const status = stockStatusOf(bal)
                const subline = [
                  itemTitle(bal.item) !== bal.item?.name ? bal.item?.name : null,
                  bal.item?.sku,
                  (bal.locationCount ?? 0) > 1 ? `${bal.locationCount} locations` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')

                return (
                  <div
                    key={bal.id}
                    role="row"
                    onClick={() => openDrawer(bal)}
                    className={`cursor-pointer border-t border-[#f4f4f6] bg-white hover:bg-[#fcfcfd] ${GRID} px-4 py-[11px]`}
                  >
                    <div role="cell" className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-[12.5px] font-medium text-[#17171c]">
                        {itemTitle(bal.item)}
                      </span>
                      {subline && (
                        <span className="truncate text-[11px] text-[#8b8b9b]">{subline}</span>
                      )}
                    </div>

                    <span role="cell" className="truncate text-[12px] text-[#5b5b6b]">
                      {bal.item?.primaryCategory?.name ?? '—'}
                    </span>

                    <span
                      role="cell"
                      className={`${MONO} text-right text-[13px] font-semibold text-[#17171c]`}
                    >
                      {bal.onHandQty.toLocaleString()}
                    </span>

                    <span role="cell" className={`${MONO} text-right text-[12.5px] text-[#8b8b9b]`}>
                      {bal.soldQty.toLocaleString()}
                    </span>

                    <span
                      role="cell"
                      className={`${MONO} text-right text-[12.5px] ${
                        bal.reservedQty > 0 ? 'text-[#8a4b06]' : 'text-[#a3a3b2]'
                      }`}
                    >
                      {bal.reservedQty.toLocaleString()}
                    </span>

                    <span
                      role="cell"
                      className={`${MONO} text-right text-[13.5px] font-semibold ${AVAILABLE_TEXT[status]}`}
                    >
                      {bal.availableQty.toLocaleString()}
                    </span>

                    <span role="cell" className="flex justify-center">
                      <StockStatusBadge status={status} />
                    </span>
                  </div>
                )
              })}

              <div className="flex flex-wrap items-center justify-between gap-[14px] border-t border-[#e4e4e9] bg-[#fbfbfc] px-4 py-[11px]">
                <span className="text-[11.5px] text-[#8b8b9b]">
                  Showing {(page - 1) * pagination.limit + 1}–
                  {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} items
                </span>
                <div className="flex items-center gap-[10px]">
                  <span className="text-[11.5px] text-[#8b8b9b]">Rows</span>
                  <select
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="rounded-[7px] border border-[#d3d3db] bg-white px-[9px] py-1.5 text-[12px] text-[#3d3d4a]"
                  >
                    <option value={20}>20</option>
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
                      onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                      disabled={page >= pagination.totalPages}
                      className="rounded-[7px] border border-[#d3d3db] bg-white px-[11px] py-1.5 text-[12px] text-[#17171c] hover:border-[#a3a3b2] disabled:text-[#a3a3b2]"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Narrow: cards */}
          {showTable && (
            <div className="flex flex-col gap-[10px] p-3 min-[1080px]:hidden">
              {balances.map((bal) => {
                const status = stockStatusOf(bal)
                const subline = [
                  itemTitle(bal.item) !== bal.item?.name ? bal.item?.name : null,
                  bal.item?.sku,
                ]
                  .filter(Boolean)
                  .join(' · ')

                return (
                  <div
                    key={bal.id}
                    onClick={() => openDrawer(bal)}
                    className="flex cursor-pointer flex-col gap-[10px] rounded-[11px] border border-[#e4e4e9] bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-[10px]">
                      <div className="flex min-w-0 flex-col gap-[3px]">
                        <span className="truncate text-[13px] font-medium">
                          {itemTitle(bal.item)}
                        </span>
                        {subline && (
                          <span className="truncate text-[11.5px] text-[#8b8b9b]">{subline}</span>
                        )}
                      </div>
                      <StockStatusBadge status={status} />
                    </div>

                    <div className="grid grid-cols-4 gap-[6px]">
                      {[
                        { label: 'On hand', value: bal.onHandQty, tone: 'text-[#17171c]' },
                        { label: 'Sold', value: bal.soldQty, tone: 'text-[#8b8b9b]' },
                        {
                          label: 'Reserved',
                          value: bal.reservedQty,
                          tone: bal.reservedQty > 0 ? 'text-[#8a4b06]' : 'text-[#a3a3b2]',
                        },
                        {
                          label: 'Available',
                          value: bal.availableQty,
                          tone: AVAILABLE_TEXT[status],
                        },
                      ].map((m) => (
                        <div
                          key={m.label}
                          className="flex flex-col gap-[2px] rounded-[8px] bg-[#fbfbfc] px-2 py-[7px]"
                        >
                          <span
                            className={`${MONO} text-[9px] uppercase tracking-[.06em] text-[#8b8b9b]`}
                          >
                            {m.label}
                          </span>
                          <span className={`${MONO} text-[14px] font-semibold ${m.tone}`}>
                            {m.value.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>

                    {bal.item?.primaryCategory?.name && (
                      <div className="rounded-[8px] border border-[#eeeef1] bg-[#fbfbfc] px-3 py-2 text-[12px] text-[#5b5b6b]">
                        {bal.item.primaryCategory.name}
                        {(bal.locationCount ?? 0) > 1 ? ` · ${bal.locationCount} locations` : ''}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div>
              <div
                className={`${GRID} ${MONO} hidden border-b border-[#eeeef1] bg-[#fbfbfc] px-4 py-[9px] text-[10px] uppercase tracking-[.09em] text-[#8b8b9b] min-[1080px]:grid`}
              >
                <span>Item</span>
                <span>Category</span>
                <span className="text-right">On Hand</span>
                <span className="text-right">Sold</span>
                <span className="text-right">Reserved</span>
                <span className="text-right">Available</span>
                <span className="text-center">Status</span>
              </div>
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`${GRID} hidden border-t border-[#f4f4f6] px-4 py-[14px] min-[1080px]:grid`}
                >
                  <SkeletonBar wide />
                  <SkeletonBar />
                  <SkeletonBar />
                  <SkeletonBar />
                  <SkeletonBar />
                  <SkeletonBar />
                  <SkeletonBar wide />
                </div>
              ))}
              <div className="flex flex-col gap-[10px] p-3 min-[1080px]:hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-2 rounded-[11px] border border-[#e4e4e9] p-3"
                  >
                    <SkeletonBar wide />
                    <SkeletonBar />
                  </div>
                ))}
              </div>
              <div className="border-t border-[#e4e4e9] bg-[#fbfbfc] px-4 py-[11px] text-[11.5px] text-[#8b8b9b]">
                Loading stock balances…
              </div>
            </div>
          )}

          {/* No results / empty */}
          {isNoResults &&
            (hasFilters ? (
              <div className="flex flex-col items-center gap-2 px-6 py-11 text-center">
                <Package className="h-[30px] w-[30px] text-[#c9c9d3]" />
                <div className="mt-1 text-[14px] font-semibold">No items match</div>
                <div className="max-w-[420px] text-[12.5px] leading-[1.55] text-[#5b5b6b]">
                  {search
                    ? `Nothing matches "${search}". Try the SKU, or clear a filter to widen the search.`
                    : 'No items fall inside these filters. Clear one to see more stock.'}
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
                  <Package className="h-4 w-4 text-[#5b21b6]" />
                </div>
                <div className="mt-1 text-[15px] font-semibold">No stock on record</div>
                <div className="max-w-[440px] text-[12.5px] leading-[1.55] text-[#5b5b6b]">
                  Balances appear here once stock is received against a purchase order or entered
                  through an opening-stock adjustment.
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
