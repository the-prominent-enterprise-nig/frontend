'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, TrendingDown, Package, ChevronDown, Hash, Search } from 'lucide-react'
import type { StockBalance } from '@/src/schema/inventory/goods-receiving'
import {
  SERIAL_STATUS_LABELS,
  type SerialNumberSummary,
} from '@/src/schema/inventory/serial-numbers'
import {
  PLEX,
  MONO,
} from '@/src/app/(app)/(dashboard)/inventory/purchase-orders/_components/procurementTokens'

function getStockStatus(balance: StockBalance): 'out' | 'critical' | 'low' | 'healthy' {
  const qty = Number(balance.onHandQty ?? 0)
  const reorder = balance.reorderPoint != null ? Number(balance.reorderPoint) : null
  if (qty <= 0) return 'out'
  if (reorder !== null && qty <= reorder * 0.5) return 'critical'
  if (reorder !== null && qty <= reorder) return 'low'
  return 'healthy'
}

const STATUS_CONFIG = {
  out: { label: 'Out', className: 'bg-[#fdeceb] text-[#b42318]', icon: AlertTriangle },
  critical: { label: 'Critical', className: 'bg-[#fdeceb] text-[#b42318]', icon: AlertTriangle },
  low: { label: 'Low', className: 'bg-[#fdf3e7] text-[#8a4b06]', icon: TrendingDown },
  healthy: { label: 'Healthy', className: 'bg-[#e7f5ef] text-[#0b6644]', icon: Package },
}

function StockSkeleton() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-[#f4f4f6]" />
      ))}
    </div>
  )
}

type Props = {
  /** Needed to build the "Transfer selected" deep link — the item this whole
   * drawer is about, since a location's picked serials are always of it. */
  itemId: string
  itemLabel: string
  balances: StockBalance[]
  isLoading: boolean
  totalOnHand?: number
  totalAvailable?: number
  totalReserved?: number
  /** Every serial for the item across all locations — filtered per row below
   * rather than fetched per location, since one request already covers the
   * whole item. */
  serials: SerialNumberSummary[]
  serialsLoading: boolean
  onSelectSerial: (serial: SerialNumberSummary) => void
}

export default function StockTab({
  itemId,
  itemLabel,
  balances,
  isLoading,
  totalOnHand,
  totalAvailable,
  totalReserved,
  serials,
  serialsLoading,
  onSelectSerial,
}: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // Both keyed by the StockBalance's own id — a location's search text and
  // its picked serials are independent of every other location's, and reset
  // implicitly (never populated) for one that's never been opened.
  const [searchByLocation, setSearchByLocation] = useState<Record<string, string>>({})
  const [selectedByLocation, setSelectedByLocation] = useState<Record<string, Set<string>>>({})

  if (isLoading) return <StockSkeleton />

  // A location with an on-hand balance of 0 (e.g. everything there was sold
  // or transferred out) still gets a StockBalance row — it isn't a place the
  // item actually stocks any more, so it doesn't belong in this breakdown.
  const stockedBalances = balances.filter((b) => Number(b.onHandQty ?? 0) > 0)

  if (stockedBalances.length === 0) {
    return (
      <div className={`${PLEX} flex flex-col items-center justify-center py-16 text-center`}>
        <Package className="mb-3 h-10 w-10 text-[#c9c9d3]" />
        <p className="text-[13px] font-medium text-[#5b5b6b]">No stock on hand</p>
        <p className="mt-1 text-[12px] text-[#8b8b9b]">Receive stock to see balances here.</p>
      </div>
    )
  }

  // Whether this item is serial-tracked at all — decides if a location row
  // even offers to expand. A non-tracked item's rows stay flat.
  const isSerialTracked = serialsLoading || serials.length > 0

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSerialSelected = (locationId: string, serialId: string) => {
    setSelectedByLocation((prev) => {
      const next = new Set(prev[locationId] ?? [])
      if (next.has(serialId)) next.delete(serialId)
      else next.add(serialId)
      return { ...prev, [locationId]: next }
    })
  }

  const setAllSelected = (locationId: string, ids: string[]) => {
    setSelectedByLocation((prev) => ({ ...prev, [locationId]: new Set(ids) }))
  }

  // A serial not currently `in_stock` (reserved, sold, in transit, damaged…)
  // can't actually leave this location, so it never gets a checkbox — only
  // shown here, with its status, so its absence from a pick isn't a mystery.
  const startTransfer = (warehouseId: string, serialIds: string[]) => {
    if (serialIds.length === 0) return
    // Only the count travels, not the ids: which physical units leave is the
    // source branch's call at dispatch (see the backend's
    // assignDispatchSerials), so a pick made here would be a promise the
    // transfer can't keep. Ticking units is still the natural way to say
    // "these many of these" — it just resolves to a quantity.
    const params = new URLSearchParams({
      prefillFromWarehouseId: warehouseId,
      prefillItemId: itemId,
      prefillItemLabel: itemLabel,
      prefillQty: String(serialIds.length),
    })
    router.push(`/inventory/transfers?${params.toString()}`)
  }

  const onHandTotal = totalOnHand ?? balances.reduce((s, b) => s + Number(b.onHandQty ?? 0), 0)
  const availableTotal =
    totalAvailable ?? balances.reduce((s, b) => s + Number(b.availableQty ?? 0), 0)
  const reservedTotal =
    totalReserved ?? balances.reduce((s, b) => s + Number(b.reservedQty ?? 0), 0)

  return (
    <div className={`${PLEX} space-y-5 p-5`}>
      {/* Aggregate summary */}
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'onHand', label: 'On Hand', value: onHandTotal, note: 'physical stock' },
            {
              key: 'reserved',
              label: 'Reserved',
              value: reservedTotal,
              note: 'committed to orders',
              tone: reservedTotal > 0 ? 'text-[#8a4b06]' : undefined,
            },
            {
              key: 'available',
              label: 'Available',
              value: availableTotal,
              note: 'sellable now',
              tone: 'text-[#0b6644]',
              highlight: true,
            },
          ].map((m) => (
            <div
              key={m.key}
              className={`rounded-lg border px-3 py-3 text-left ${
                m.highlight ? 'border-[#c3e5d6] bg-[#f4fbf7]' : 'border-[#e4e4e9] bg-[#fbfbfc]'
              }`}
            >
              <p
                className={`${MONO} text-[10px] font-semibold tracking-[.08em] text-[#8b8b9b] uppercase`}
              >
                {m.label}
              </p>
              <p
                className={`${MONO} mt-0.5 text-[22px] leading-tight font-bold ${m.tone ?? 'text-[#17171c]'}`}
                suppressHydrationWarning
              >
                {m.value.toLocaleString()}
              </p>
              <p className="mt-0.5 text-[11px] text-[#8b8b9b]">{m.note}</p>
            </div>
          ))}
        </div>
        <p className={`${MONO} text-[11.5px] text-[#5b5b6b]`}>
          {onHandTotal.toLocaleString()} on hand − {reservedTotal.toLocaleString()} reserved ={' '}
          {availableTotal.toLocaleString()} available
        </p>
      </div>

      {/* Per-location breakdown */}
      <div className="overflow-hidden rounded-xl border border-[#e4e4e9] bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-[#eeeef1] px-4 py-3">
          <span className="text-[13px] font-semibold text-[#17171c]">Stock by location</span>
          <span className="text-[11.5px] text-[#8b8b9b]">Click a location to see its serials</span>
        </div>
        <div className="divide-y divide-[#f4f4f6]">
          {stockedBalances.map((balance) => {
            const status = getStockStatus(balance)
            const cfg = STATUS_CONFIG[status]
            const StatusIcon = cfg.icon
            const canExpand = isSerialTracked && Number(balance.onHandQty ?? 0) > 0
            const isOpen = canExpand && expanded.has(balance.id)
            const locationSerials = serials.filter(
              (s) => (s.warehouse ?? s.currentWarehouse)?.id === balance.warehouse?.id
            )
            const query = (searchByLocation[balance.id] ?? '').trim().toLowerCase()
            const filteredSerials = query
              ? locationSerials.filter((s) => s.serialNumber.toLowerCase().includes(query))
              : locationSerials
            const selectedIds = selectedByLocation[balance.id] ?? new Set<string>()
            const selectableIds = filteredSerials
              .filter((s) => s.status === 'in_stock')
              .map((s) => s.id)
            const allSelectableSelected =
              selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id))

            return (
              <div key={balance.id} data-testid="stock-location-row">
                <div
                  role={canExpand ? 'button' : undefined}
                  tabIndex={canExpand ? 0 : undefined}
                  onClick={canExpand ? () => toggleExpand(balance.id) : undefined}
                  onKeyDown={
                    canExpand
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleExpand(balance.id)
                          }
                        }
                      : undefined
                  }
                  className={`flex items-center justify-between gap-3 px-4 py-3 ${
                    canExpand ? 'cursor-pointer hover:bg-[#fcfcfd]' : ''
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {canExpand && (
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 text-[#a3a3b2] transition-transform ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[#17171c]">
                        {balance.warehouse?.branch?.name ??
                          balance.warehouse?.name ??
                          balance.warehouse?.code ??
                          '—'}
                      </p>
                      {balance.reservedQty > 0 && (
                        <p className="text-[11px] text-[#8a4b06]">
                          {balance.reservedQty} reserved against open orders
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <div className="text-right">
                      <p
                        className={`${MONO} text-[15px] font-bold text-[#17171c]`}
                        suppressHydrationWarning
                      >
                        {Number(balance.onHandQty ?? 0).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-[#8b8b9b]">on hand</p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`${MONO} text-[15px] font-bold text-[#0b6644]`}
                        suppressHydrationWarning
                      >
                        {Number(balance.availableQty ?? 0).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-[#8b8b9b]">available</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-[5px] px-2 py-0.5 text-[11.5px] font-medium ${cfg.className}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                  </div>
                </div>

                {isOpen && (
                  <div
                    data-testid="location-serials-panel"
                    className="border-t border-[#f1f1f4] bg-[#fbfaff] px-4 py-3 pl-[38px]"
                  >
                    <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                      <p
                        className={`${MONO} text-[9.5px] font-semibold tracking-[.08em] text-[#8b8b9b] uppercase`}
                      >
                        Serial numbers at this location
                      </p>
                      {locationSerials.length > 0 && (
                        <div className="relative">
                          <Search className="pointer-events-none absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2 text-[#a3a3b2]" />
                          <input
                            value={searchByLocation[balance.id] ?? ''}
                            onChange={(e) =>
                              setSearchByLocation((prev) => ({
                                ...prev,
                                [balance.id]: e.target.value,
                              }))
                            }
                            type="text"
                            placeholder="Search serial…"
                            className="w-44 rounded-[7px] border border-[#e4e4e9] bg-white py-1 pr-2 pl-6 text-[11.5px] text-[#17171c] outline-none focus:border-[#5b21b6]"
                          />
                        </div>
                      )}
                    </div>

                    {serialsLoading ? (
                      <div className="flex flex-col gap-1.5">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-8 w-full animate-pulse rounded-[8px] bg-[#eeeef1]"
                          />
                        ))}
                      </div>
                    ) : locationSerials.length === 0 ? (
                      <p className="flex items-center gap-1.5 text-[12px] text-[#8b8b9b]">
                        <Hash className="h-3.5 w-3.5 shrink-0" />
                        No serial numbers registered for this location yet.
                      </p>
                    ) : filteredSerials.length === 0 ? (
                      <p className="text-[12px] text-[#8b8b9b]">
                        No serials match &ldquo;{searchByLocation[balance.id]}&rdquo;.
                      </p>
                    ) : (
                      <>
                        {selectableIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setAllSelected(balance.id, allSelectableSelected ? [] : selectableIds)
                            }
                            className="mb-2 text-[11px] font-medium text-[#5b21b6] hover:underline"
                          >
                            {allSelectableSelected
                              ? 'Clear selection'
                              : `Select all ${selectableIds.length} in-stock`}
                          </button>
                        )}
                        <div className="flex flex-col gap-1.5">
                          {filteredSerials.map((serial) => {
                            const selectable = serial.status === 'in_stock'
                            const isChecked = selectedIds.has(serial.id)
                            return (
                              <div
                                key={serial.id}
                                className={`flex items-center gap-2.5 rounded-[8px] border px-2.5 py-2 ${
                                  isChecked
                                    ? 'border-[#5b21b6] bg-[#f7f3ff]'
                                    : 'border-[#e4e4e9] bg-white'
                                }`}
                              >
                                {selectable ? (
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleSerialSelected(balance.id, serial.id)}
                                    className="h-3.5 w-3.5 shrink-0 rounded border-zinc-300 text-[#5b21b6] focus:ring-[#5b21b6]"
                                  />
                                ) : (
                                  <span className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                )}
                                <button
                                  type="button"
                                  data-testid="serial-chip"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onSelectSerial(serial)
                                  }}
                                  className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                                >
                                  <span
                                    className={`${MONO} truncate text-[11.5px] font-medium text-[#3d3d4a]`}
                                  >
                                    {serial.serialNumber}
                                  </span>
                                  {!selectable && (
                                    <span className="shrink-0 rounded-[5px] bg-[#f1f1f4] px-1.5 py-0.5 text-[10px] font-medium text-[#5b5b6b]">
                                      {SERIAL_STATUS_LABELS[serial.status]}
                                    </span>
                                  )}
                                </button>
                              </div>
                            )
                          })}
                        </div>

                        {selectedIds.size > 0 && balance.warehouse?.id && (
                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-[#ddd0f7] bg-[#f1ebfb] px-3 py-2">
                            <span className="text-[11.5px] font-medium text-[#3f1490]">
                              {selectedIds.size} selected
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                startTransfer(balance.warehouse!.id, Array.from(selectedIds))
                              }
                              className="rounded-[6px] bg-[#5b21b6] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#4a189b]"
                            >
                              Transfer selected
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
