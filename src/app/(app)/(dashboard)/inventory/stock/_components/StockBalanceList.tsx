'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Package, X } from 'lucide-react'
import { useStockBalance } from '../_hooks/useStockBalance'
import { useUIShell } from '@/src/stores/ui-shell.store'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import CategorySelect from '@/src/components/ui/CategorySelect'
import Tooltip from '@/src/components/ui/Tooltip'
import { PLEX, MONO } from '../../purchase-orders/_components/procurementTokens'
import type { StockBalance, StockStateFilter } from '@/src/schema/inventory/goods-receiving'
import type { LocationToken } from '@/src/libs/inventory/location-tokens'
import {
  ListFooterPager,
  STOCK_LEDGER_PAGE_SIZES,
} from '@/src/components/inventory/ListFooterPager'
import { StockStatusBadge } from '@/src/components/inventory/StockStatusBadge'
import { stockStatusOf, stockTotalOf, type StockStatus } from '@/src/libs/inventory/stock-status'

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
  { value: 'panay', label: 'Panay Warehouse' },
  { value: 'negros', label: 'Negros Warehouse' },
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
// unattributed 5. Scenario 56 shows it as a second "In Transit · N" badge
// under the row's stock state instead; the drawer breaks it down per location.
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

const AVAILABLE_TEXT: Record<StockStatus, string> = {
  out: 'text-[#b42318]',
  fully_reserved: 'text-[#1f4b99]',
  low: 'text-[#8a4b06]',
  in_stock: 'text-[#0b6644]',
}

/** The seven-column track the header, rows and skeletons all share — same
 * `role="table"`/CSS-grid approach as Purchase Orders, since assistive tech
 * and this module's e2e specs both lean on the explicit table semantics. */
const GRID =
  'grid grid-cols-[minmax(0,1fr)_160px_84px_96px_68px_84px_96px_118px] gap-x-3 items-center'

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
  onLocationsChange,
}: {
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
    setLimit,
    locationOptions,
    locationsLoading,
    categoryOptions,
  } = useStockBalance(onLocationsChange, useSearchParams().get('search') ?? '')

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
      region,
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
            <p className="text-[13px] text-[#4b4b5a]">
              One row per item — on-hand, sold, reserved and available, rolled up across every
              selected location.
            </p>
          </div>
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
          <div className="grid grid-cols-2 divide-x divide-y divide-[#eeeef1] overflow-hidden rounded-xl border border-[#e4e4e9] bg-white min-[640px]:grid-cols-3 min-[1280px]:grid-cols-6 min-[1080px]:divide-y-0">
            <div className="flex flex-col gap-1 px-4 py-3">
              <span className={`${MONO} text-[10px] uppercase tracking-[.08em] text-ink-muted`}>
                Items
              </span>
              <span className={`${MONO} text-[17px] font-semibold tracking-[-.01em]`}>
                {pagination.total.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col gap-1 px-4 py-3">
              <span className={`${MONO} text-[10px] uppercase tracking-[.08em] text-ink-muted`}>
                Total
              </span>
              <span className={`${MONO} text-[17px] font-semibold tracking-[-.01em]`}>
                {stockTotalOf({
                  availableQty: summary?.totalAvailableQty ?? 0,
                  reservedQty: summary?.totalReservedQty ?? 0,
                  soldQty: summary?.totalSoldQty ?? 0,
                  inTransitQty: summary?.totalInTransitQty ?? 0,
                }).toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col gap-1 px-4 py-3">
              <span className={`${MONO} text-[10px] uppercase tracking-[.08em] text-ink-muted`}>
                Transferred
              </span>
              <span className={`${MONO} text-[17px] font-semibold tracking-[-.01em]`}>
                {(summary?.totalInTransitQty ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col gap-1 px-4 py-3">
              <span className={`${MONO} text-[10px] uppercase tracking-[.08em] text-ink-muted`}>
                Sold
              </span>
              <span className={`${MONO} text-[17px] font-semibold tracking-[-.01em]`}>
                {(summary?.totalSoldQty ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col gap-1 px-4 py-3">
              <span className={`${MONO} text-[10px] uppercase tracking-[.08em] text-ink-muted`}>
                Reserved
              </span>
              <span
                className={`${MONO} text-[17px] font-semibold tracking-[-.01em] ${
                  (summary?.totalReservedQty ?? 0) > 0 ? 'text-[#8a4b06]' : 'text-[#17171c]'
                }`}
              >
                {(summary?.totalReservedQty ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col gap-1 bg-[#f4fbf7] px-4 py-3">
              <span className={`${MONO} text-[10px] uppercase tracking-[.08em] text-ink-muted`}>
                Available
              </span>
              <span
                className={`${MONO} text-[17px] font-semibold tracking-[-.01em] text-[#0b6644]`}
              >
                {(summary?.totalAvailableQty ?? 0).toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-[10px] rounded-xl border border-[#e4e4e9] bg-white p-3">
          {/* Search — brand, model or category only. Serial numbers were
              deliberately dropped: a serial belongs to one unit, not to the
              rolled-up quantity this list reports. A line of its own, the
              filters below it (as on the General Stockbook's head-office bar). */}
          <div
            className={`flex h-[38px] min-w-[220px] basis-full items-center gap-[9px] rounded-lg border px-3 transition-colors ${
              searchFocus ? CONTROL_CHROME.focused : CONTROL_CHROME.idle
            }`}
          >
            <Search className="h-3.25 w-3.25 shrink-0 text-ink-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
              placeholder="Search brand, model, or category…"
              className="min-w-0 flex-1 border-none bg-transparent p-0 text-[13px] text-[#17171c] outline-none placeholder:text-ink-faint"
            />
            {search !== '' && (
              <Tooltip label="Clear search" side="bottom" align="end">
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-[#f1f1f4] hover:text-[#3d3d4a]"
                >
                  <X className="h-3 w-3" />
                </button>
              </Tooltip>
            )}
          </div>

          {/* Operations — the client's name for region. */}
          <SearchableSelect
            className="min-w-[180px] flex-1"
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
            className="min-w-[200px] flex-1"
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
            className="min-w-[180px] flex-1"
            value={categoryId}
            onChange={setCategoryId}
            options={categoryOptions}
            placeholder="All Categories"
          />

          {/* Stock state — settled stock vs units still on an open transfer. */}
          <SearchableSelect
            className="min-w-[160px] flex-1"
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
              className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg px-[11px] py-[6px] text-[12.5px] text-[#5b21b6] hover:bg-[#f1ebfb]"
            >
              <X className="h-3.5 w-3.5" />
              Clear {activeFilterCount > 0 ? activeFilterCount : ''}{' '}
              {activeFilterCount === 1 ? 'filter' : 'filters'}
            </button>
          )}
        </div>

        {/* Scenario 60 Part 4 — a serial number typed into the search above
            matches here, independently of the item rollup below (which
            never shows a "no results" for it, since brand/model/category
            genuinely don't match a serial string). Works for a sold serial
            too — this is the intuitive, one-step path the client asked for,
            replacing "open the item, then search again inside its drawer". */}

        {/* Table card */}
        <div className="overflow-hidden rounded-xl border border-[#e4e4e9] bg-white">
          {/* Wide: CSS-grid table, same approach as Purchase Orders — explicit
              role="table"/"row"/"cell" since the markup isn't a <table>. */}
          {showTable && (
            <div role="table" aria-label="Stock balance" className="hidden min-[1280px]:block">
              <div
                role="row"
                className={`${GRID} ${MONO} border-b border-[#eeeef1] bg-[#fbfbfc] px-4 py-[9px] text-[12px] uppercase tracking-[.09em] text-ink-muted`}
              >
                <span role="columnheader">Item</span>
                <span role="columnheader">Category</span>
                <span role="columnheader" className="text-right">
                  Total
                </span>
                <span role="columnheader" className="text-right">
                  Transferred
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
                      <span className="break-words text-[13px] font-medium leading-snug text-[#17171c]">
                        {itemTitle(bal.item)}
                      </span>
                      {subline && (
                        <span className="break-words text-[13px] leading-snug text-ink-muted">
                          {subline}
                        </span>
                      )}
                    </div>

                    <span
                      role="cell"
                      className="break-words text-[14px] leading-snug text-[#4b4b5a]"
                    >
                      {bal.item?.primaryCategory?.name ?? '—'}
                    </span>

                    <span
                      role="cell"
                      className={`${MONO} text-right text-[13.5px] font-semibold text-[#17171c]`}
                    >
                      {stockTotalOf(bal).toLocaleString()}
                    </span>

                    <span
                      role="cell"
                      className={`${MONO} text-right text-[13px] ${
                        bal.inTransitQty > 0 ? 'text-[#1d4ed8]' : 'text-ink-subtle'
                      }`}
                    >
                      {bal.inTransitQty.toLocaleString()}
                    </span>

                    <span role="cell" className={`${MONO} text-right text-[13px] text-ink-muted`}>
                      {bal.soldQty.toLocaleString()}
                    </span>

                    <span
                      role="cell"
                      className={`${MONO} text-right text-[13px] ${
                        bal.reservedQty > 0 ? 'text-[#8a4b06]' : 'text-ink-subtle'
                      }`}
                    >
                      {bal.reservedQty.toLocaleString()}
                    </span>

                    <span
                      role="cell"
                      className={`${MONO} text-right text-[14px] font-semibold ${AVAILABLE_TEXT[status]}`}
                    >
                      {bal.availableQty.toLocaleString()}
                    </span>

                    <span role="cell" className="flex justify-center">
                      <StockStatusBadge status={status} inTransitQty={bal.inTransitQty} stacked />
                    </span>
                  </div>
                )
              })}

              <ListFooterPager
                page={page}
                pageCount={pagination.totalPages}
                total={pagination.total}
                limit={pagination.limit}
                noun="items"
                onPageChange={setPage}
                onLimitChange={setLimit}
                pageSizes={STOCK_LEDGER_PAGE_SIZES}
                showPageNumber={false}
              />
            </div>
          )}

          {/* Narrow: cards */}
          {showTable && (
            <div className="flex flex-col gap-[10px] p-3 min-[1280px]:hidden">
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
                        <span className="break-words text-[13px] font-medium leading-snug">
                          {itemTitle(bal.item)}
                        </span>
                        {subline && (
                          <span className="break-words text-[11.5px] leading-snug text-ink-muted">
                            {subline}
                          </span>
                        )}
                      </div>
                      <StockStatusBadge status={status} inTransitQty={bal.inTransitQty} stacked />
                    </div>

                    <div className="grid grid-cols-5 gap-[6px]">
                      {[
                        { label: 'Total', value: stockTotalOf(bal), tone: 'text-[#17171c]' },
                        {
                          label: 'Transferred',
                          value: bal.inTransitQty,
                          tone: bal.inTransitQty > 0 ? 'text-[#1d4ed8]' : 'text-ink-subtle',
                        },
                        { label: 'Sold', value: bal.soldQty, tone: 'text-ink-muted' },
                        {
                          label: 'Reserved',
                          value: bal.reservedQty,
                          tone: bal.reservedQty > 0 ? 'text-[#8a4b06]' : 'text-ink-subtle',
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
                            className={`${MONO} text-[9px] uppercase tracking-[.06em] text-ink-muted`}
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
                      <div className="rounded-[8px] border border-[#eeeef1] bg-[#fbfbfc] px-3 py-2 text-[12px] text-[#4b4b5a]">
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
                className={`${GRID} ${MONO} hidden border-b border-[#eeeef1] bg-[#fbfbfc] px-4 py-[9px] text-[10px] uppercase tracking-[.09em] text-ink-muted min-[1280px]:grid`}
              >
                <span>Item</span>
                <span>Category</span>
                <span className="text-right">Total</span>
                <span className="text-right">Transferred</span>
                <span className="text-right">Sold</span>
                <span className="text-right">Reserved</span>
                <span className="text-right">Available</span>
                <span className="text-center">Status</span>
              </div>
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`${GRID} hidden border-t border-[#f4f4f6] px-4 py-[14px] min-[1280px]:grid`}
                >
                  <SkeletonBar wide />
                  <SkeletonBar />
                  <SkeletonBar />
                  <SkeletonBar />
                  <SkeletonBar />
                  <SkeletonBar />
                  <SkeletonBar />
                  <SkeletonBar wide />
                </div>
              ))}
              <div className="flex flex-col gap-[10px] p-3 min-[1280px]:hidden">
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
              <div className="border-t border-[#e4e4e9] bg-[#fbfbfc] px-4 py-[11px] text-[11.5px] text-ink-muted">
                Loading stock balances…
              </div>
            </div>
          )}

          {/* No results / empty */}
          {isNoResults &&
            (hasFilters ? (
              <div className="flex flex-col items-center gap-2 px-6 py-11 text-center">
                <Package className="h-[30px] w-[30px] text-ink-faint" />
                <div className="mt-1 text-[14px] font-semibold">No items match</div>
                <div className="max-w-[420px] text-[12.5px] leading-[1.55] text-[#4b4b5a]">
                  {search
                    ? `Nothing matches "${search}". Try the SKU, model or serial number, or clear a filter to widen the search.`
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
                <div className="mt-1 text-[13.5px] font-semibold">No stock on record</div>
                <div className="max-w-[440px] text-[12.5px] leading-[1.55] text-[#4b4b5a]">
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
