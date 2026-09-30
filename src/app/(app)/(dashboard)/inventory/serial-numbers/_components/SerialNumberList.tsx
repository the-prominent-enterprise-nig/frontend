'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Hash, X, Truck, Search, ArrowRightLeft } from 'lucide-react'
import { useSerialNumbers } from '../_hooks/useSerialNumbers'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import {
  SERIAL_STATUS_LABELS,
  SERIAL_STATUS_COLORS,
  SERIAL_STATUS_DOT_COLORS,
  SERIAL_STATUS_FILTER_GROUPS,
  type SerialStatus,
} from '@/src/schema/inventory/serial-numbers'
import RegisterSerialsModal from './RegisterSerialsModal'
import ImportSerializedInventoryModal from './ImportSerializedInventoryModal'
import ConsignToCaravanModal from './ConsignToCaravanModal'
import { useSerialSelection, isConsignable } from '../_hooks/useSerialSelection'
import { useConsignToCaravan } from '../_hooks/useConsignToCaravan'
import CaravanItemTable from './CaravanItemTable'
import EndedCaravansBanner from '@/src/components/inventory/caravan/EndedCaravansBanner'
import CopySerialButton from './CopySerialButton'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import Tooltip from '@/src/components/ui/Tooltip'
import { StatusBadge } from '@/src/components/ui/StatusBadge'
import { PLEX, MONO } from '../../purchase-orders/_components/procurementTokens'
import { formatShortDate } from '@/src/libs/format/date'
import { SerialAges } from '@/src/components/inventory/SerialAges'
import { originLabel } from '@/src/libs/format/serial-provenance'
import { displayClassificationLabel } from '@/src/libs/format/text'
import { locationLabel } from '@/src/libs/format/locationLabel'
import { LocationFilters } from '@/src/components/inventory/LocationFilters'
import SerialLink from '@/src/components/inventory/serial-history/SerialLink'
import { useUIShell } from '@/src/stores/ui-shell.store'

// ─── Design tokens ────────────────────────────────────────────────────────────
// Matches Stock Balance's own #5b21b6 palette (same StockHub tab group), so
// the two lists in the Stock hub read as one design language.

const statusOptions = SERIAL_STATUS_FILTER_GROUPS.flatMap(({ group, statuses }) =>
  statuses.map((s) => ({ value: s, label: SERIAL_STATUS_LABELS[s], group }))
)

const CONTROL_CHROME = {
  idle: 'border-[#d3d3db]',
  focused: 'border-[#5b21b6] shadow-[0_0_0_3px_#f0e9fc]',
}

function brandModel(
  item?: { name: string; modelNumber?: string | null; brand?: { name: string } | null } | null
): string {
  if (!item) return '—'
  const parts = [item.brand?.name, item.modelNumber].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : item.name
}

function SerialStatusPill({ status }: { status: SerialStatus }) {
  return (
    <StatusBadge
      label={SERIAL_STATUS_LABELS[status]}
      colorClassName={SERIAL_STATUS_COLORS[status]}
      dotClassName={SERIAL_STATUS_DOT_COLORS[status]}
      size="xs"
    />
  )
}

// A unit an open transfer already claims (requested through partially
// received) — says which one, so it's clear why the row can't be consigned.
function OpenTransferChip({ number }: { number: string }): React.JSX.Element {
  return (
    <Tooltip label="Open this transfer">
      <Link
        href={`/inventory/transfers?transfer=${encodeURIComponent(number)}`}
        onClick={(e) => e.stopPropagation()}
        className={`${MONO} inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#f1ebfb] px-2 py-0.5 text-[11.5px] font-medium text-[#5b21b6] hover:bg-[#e6dcf8]`}
      >
        <ArrowRightLeft className="h-3 w-3" />
        On {number}
      </Link>
    </Tooltip>
  )
}

function MetricCell({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: number
  sub: string
  highlight?: boolean
}) {
  return (
    <div className={`flex flex-col gap-1 px-4 py-3 ${highlight ? 'bg-[#f4fbf7]' : ''}`}>
      <span className={`${MONO} text-[10px] uppercase tracking-[.08em] text-[#8b8b9b]`}>
        {label}
      </span>
      <span
        className={`${MONO} text-[20px] font-semibold tracking-[-.01em] ${
          highlight ? 'text-[#0b6644]' : 'text-[#17171c]'
        }`}
      >
        {value.toLocaleString()}
      </span>
      <span className="text-[11px] text-[#8b8b9b]">{sub}</span>
    </div>
  )
}

export default function SerialNumberList({
  session,
  initialCaravanId,
}: {
  session: SessionUser
  initialCaravanId?: string
}) {
  const { pushPanel } = useUIShell()
  const canManage = hasPermission(session, INVENTORY_PERMISSIONS.SERIAL_MANAGE)
  const canTransfer = hasPermission(session, INVENTORY_PERMISSIONS.TRANSFERS_CREATE)
  const canConsign = canTransfer && hasPermission(session, INVENTORY_PERMISSIONS.CARAVAN_MANAGE)
  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)

  const {
    serials,
    pagination,
    statusCounts,
    isLoading,
    error,
    statusFilter,
    categoryFilter: _categoryFilter,
    brandFilter,
    locationFilter,
    search,
    setStatusFilter,
    setBrandFilter,
    setSearch,
    resetFilters,
    page,
    setPage,
    limit,
    setLimit,
    warehouseOptions,
    itemOptions,
    registerSerials,
    isRegistering,
    caravanView,
    setCaravanView,
    caravanId,
    setCaravanId,
    caravanOptions,
    caravanReady,
    caravanGroups,
    isGroupOpen,
    toggleGroup,
    groupSerials,
  } = useSerialNumbers({ initialCaravanId })

  const openCaravan = (id: string): void => {
    setCaravanView(true)
    setCaravanId(id)
  }

  const brandOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const item of itemOptions) {
      if (item.brand?.id && !seen.has(item.brand.id)) seen.set(item.brand.id, item.brand.name)
    }
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }, [itemOptions])

  const hasFilters =
    statusFilter ||
    locationFilter.locations.length > 0 ||
    locationFilter.region ||
    search ||
    brandFilter

  // Scenario 60 — tick in-stock units, then "Consign to Caravan": a new
  // caravan plus a stock transfer carrying exactly those units.
  const selection = useSerialSelection(serials)
  const [isConsignOpen, setIsConsignOpen] = useState(false)
  const { consignToCaravan, isConsigning } = useConsignToCaravan(selection.clear)
  const showSelection = canConsign && !caravanView

  const inService = statusCounts.in_repair + statusCounts.defective + statusCounts.pulled_out

  return (
    <div className={`${PLEX} min-h-screen bg-zinc-50 text-[#17171c] antialiased`}>
      <div className="mx-auto flex max-w-[1560px] flex-col gap-[14px] p-[14px] min-[1080px]:px-5 min-[1080px]:py-[22px]">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-[21px] font-semibold tracking-[-0.015em]">
              Serial Number Tracking
            </h1>
            <p className="text-[13px] text-[#5b5b6b]">
              Every serialised unit, where it sits and what has happened to it.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <button
                type="button"
                onClick={() => setIsRegisterOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-[9px] text-[13px] font-medium text-white hover:bg-[#4c1a9b]"
              >
                <Hash className="h-3.5 w-3.5" />
                Register serials
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-[9px] border border-[#f3c9c5] bg-[#fdeceb] px-[14px] py-[10px]">
            <p className="text-[12.5px] font-medium text-[#b42318]">
              Failed to load serial numbers
            </p>
          </div>
        )}

        {/* Metric band — totals across every matching record, so it only
            applies to the All Serials tab; Caravan has no equivalent
            aggregate to show. */}
        {!caravanView && !isLoading && (
          <div className="grid grid-cols-2 divide-x divide-y divide-[#eeeef1] overflow-hidden rounded-xl border border-[#e4e4e9] bg-white min-[640px]:grid-cols-3 min-[1080px]:grid-cols-6 min-[1080px]:divide-y-0">
            <MetricCell label="Registered" value={pagination.total} sub="total units" />
            <MetricCell
              label="In Stock"
              value={statusCounts.in_stock}
              sub="available to sell"
              highlight
            />
            <MetricCell label="Reserved" value={statusCounts.held} sub="claimed for a sale" />
            <MetricCell label="In Transit" value={statusCounts.in_transit} sub="on a transfer" />
            <MetricCell label="Service" value={inService} sub="repair, defective, pulled out" />
            <MetricCell label="Sold" value={statusCounts.sold} sub="out of stock" />
          </div>
        )}

        {/* Scenario 60 Part 3 — ended caravans still holding stock. The
            Caravan tab's own cards already show them, so only on All Serials.
            Gated on transfers:create: those are the people who can act. */}
        {!caravanView && (
          <EndedCaravansBanner variant="inventory" enabled={canTransfer} onView={openCaravan} />
        )}

        {/* Scenario 08 (Caravan) Part 2 — tabs */}
        <div className="flex gap-1 border-b border-[#e4e4e9]">
          <button
            type="button"
            onClick={() => setCaravanView(false)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-[13px] font-medium ${
              !caravanView
                ? 'border-[#5b21b6] text-[#5b21b6]'
                : 'border-transparent text-[#5b5b6b] hover:text-[#17171c]'
            }`}
          >
            All Serials
          </button>
          <button
            type="button"
            onClick={() => setCaravanView(true)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-[13px] font-medium ${
              caravanView
                ? 'border-[#5b21b6] text-[#5b21b6]'
                : 'border-transparent text-[#5b5b6b] hover:text-[#17171c]'
            }`}
          >
            <Truck className="h-3.5 w-3.5" />
            Caravan
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-[10px] rounded-xl border border-[#e4e4e9] bg-white p-3">
          <div
            className={`flex h-[38px] min-w-[220px] flex-[1_1_280px] items-center gap-[9px] rounded-lg border px-3 transition-colors ${CONTROL_CHROME.idle} focus-within:border-[#5b21b6] focus-within:shadow-[0_0_0_3px_#f0e9fc]`}
          >
            <Search className="h-3.25 w-3.25 shrink-0 text-[#8b8b9b]" />
            <input
              value={search ?? ''}
              onChange={(e) => setSearch(e.target.value || undefined)}
              placeholder="Search serial, brand, model, category, RR or supplier…"
              className="min-w-0 flex-1 border-none bg-transparent p-0 text-[13px] text-[#17171c] outline-none placeholder:text-[#a3a3b2]"
            />
          </div>

          <SearchableSelect
            className="w-[150px]"
            value={statusFilter ?? ''}
            onChange={(v) => setStatusFilter((v || undefined) as SerialStatus | undefined)}
            placeholder="All statuses"
            chrome={CONTROL_CHROME}
            clearable
            options={statusOptions}
          />

          {caravanView ? (
            <SearchableSelect
              className="w-[320px]"
              value={caravanId ?? ''}
              onChange={(v) => setCaravanId(v || undefined)}
              placeholder="All caravans"
              chrome={CONTROL_CHROME}
              clearable
              options={caravanOptions}
            />
          ) : (
            <LocationFilters filter={locationFilter} chrome={CONTROL_CHROME} />
          )}

          {!caravanView && (
            <SearchableSelect
              className="w-[150px]"
              value={brandFilter ?? ''}
              onChange={(v) => setBrandFilter(v || undefined)}
              placeholder="All brands"
              chrome={CONTROL_CHROME}
              clearable
              options={brandOptions.map((b) => ({ value: b.id, label: b.name }))}
            />
          )}

          {hasFilters && !caravanView && (
            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto flex items-center gap-1.5 rounded-lg px-[11px] py-[6px] text-[12.5px] text-[#5b21b6] hover:bg-[#f1ebfb]"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>

        {showSelection && selection.selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-[9px] border border-[#ddd0f7] bg-[#f1ebfb] p-3">
            <span className="text-[12.5px] font-medium text-[#3f1490]">
              {selection.selected.length} selected
            </span>
            <button
              type="button"
              onClick={() => setIsConsignOpen(true)}
              disabled={selection.mixedSources}
              className="flex items-center gap-1.5 rounded-lg bg-[#5b21b6] px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#4c1a9b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Truck className="h-3.5 w-3.5" />
              Consign to Caravan
            </button>
            <button
              type="button"
              onClick={selection.clear}
              className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-[#5b21b6] hover:bg-white"
            >
              Clear
            </button>
            {selection.mixedSources && (
              <span className="text-[12px] text-[#8a4b06]">
                Tick units from one branch only — a transfer leaves from a single source.
              </span>
            )}
          </div>
        )}

        {/* Table card */}
        {(!caravanView || caravanReady) && (
          <>
            <div className="overflow-hidden rounded-xl border border-[#e4e4e9] bg-white">
              {isLoading ? (
                <div>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 border-t border-[#f4f4f6] px-4 py-[14px] first:border-t-0"
                    >
                      <div className="h-4 w-28 animate-pulse rounded bg-[#eeeef1]" />
                      <div className="h-4 w-40 animate-pulse rounded bg-[#eeeef1]" />
                      <div className="ml-auto h-4 w-16 animate-pulse rounded bg-[#eeeef1]" />
                    </div>
                  ))}
                </div>
              ) : caravanView ? (
                <CaravanItemTable
                  groups={caravanGroups}
                  canTransfer={canTransfer}
                  isGroupOpen={isGroupOpen}
                  onToggleGroup={toggleGroup}
                  groupSerials={groupSerials}
                  emptyLabel={
                    caravanId
                      ? 'Nothing currently at this caravan'
                      : 'Nothing currently out on caravan'
                  }
                />
              ) : serials.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-11 text-center">
                  <Hash className="h-[30px] w-[30px] text-[#c9c9d3]" />
                  {hasFilters ? (
                    <>
                      <div className="mt-1 text-[14px] font-semibold">
                        No serial numbers match your filters
                      </div>
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="mt-2 rounded-lg border border-[#d3d3db] bg-white px-[15px] py-[9px] text-[13px] font-medium text-[#17171c] hover:border-[#a3a3b2]"
                      >
                        Clear filters
                      </button>
                    </>
                  ) : (
                    <div className="mt-1 text-[14px] font-semibold">No serial numbers found</div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr
                        className={`${MONO} border-b border-[#eeeef1] bg-[#fbfbfc] text-[12px] uppercase tracking-[.09em] text-[#8b8b9b]`}
                      >
                        {showSelection && (
                          <th className="w-10 px-4 py-[9px]">
                            <input
                              type="checkbox"
                              aria-label="Select all in-stock units"
                              checked={selection.allSelected}
                              onChange={selection.toggleAll}
                              className="h-4 w-4 rounded border-zinc-300 text-[#5b21b6] focus:ring-[#5b21b6]"
                            />
                          </th>
                        )}
                        <th className="px-4 py-[9px] text-left">Serial #</th>
                        <th className="px-4 py-[9px] text-left hidden sm:table-cell">Location</th>
                        <th className="px-4 py-[9px] text-left hidden lg:table-cell">
                          Brand / Model
                        </th>
                        <th className="px-4 py-[9px] text-left hidden lg:table-cell">Receipt</th>
                        <th className="px-4 py-[9px] text-left hidden lg:table-cell">Origin</th>
                        <th className="px-4 py-[9px] text-left hidden md:table-cell">Date In</th>
                        <th className="px-4 py-[9px] text-left hidden md:table-cell">Age</th>
                        <th className="px-4 py-[9px] text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f4f4f6]">
                      {serials.map((serial) => (
                        <tr
                          key={serial.id}
                          // The whole row opens the unit's history — the
                          // serial number below is the keyboard-reachable
                          // version of the same action.
                          onClick={() =>
                            pushPanel({
                              type: 'serial',
                              serialId: serial.id,
                              serialNumber: serial.serialNumber,
                            })
                          }
                          className={`cursor-pointer hover:bg-[#fcfcfd] ${
                            selection.isSelected(serial.id) ? 'bg-[#f8f4fd]' : ''
                          }`}
                        >
                          {showSelection && (
                            <td className="px-4 py-[11px]" onClick={(e) => e.stopPropagation()}>
                              {isConsignable(serial) && (
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${serial.serialNumber}`}
                                  checked={selection.isSelected(serial.id)}
                                  onChange={() => selection.toggle(serial.id)}
                                  className="h-4 w-4 rounded border-zinc-300 text-[#5b21b6] focus:ring-[#5b21b6]"
                                />
                              )}
                            </td>
                          )}
                          <td className="px-4 py-[11px]">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <SerialLink
                                  serialId={serial.id}
                                  serialNumber={serial.serialNumber}
                                  className={`${MONO} text-[14.5px] font-semibold text-[#17171c]`}
                                />
                                <CopySerialButton serialNumber={serial.serialNumber} />
                              </div>
                              {displayClassificationLabel(serial.item?.type?.name) && (
                                <span className="text-[13px] text-[#8b8b9b]">
                                  {displayClassificationLabel(serial.item?.type?.name)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-[11px] text-[14.5px] text-[#5b5b6b] hidden sm:table-cell">
                            {(() => {
                              const wh = serial.warehouse ?? serial.currentWarehouse
                              const owner = locationLabel(wh)
                              // A unit out at a venue is physically at the
                              // venue, not on the shelf its warehouse names —
                              // that warehouse is only who still owns it.
                              if (!serial.consignedToVenue) return owner
                              return (
                                <div>
                                  <div className="font-medium text-[#8a4b06]">
                                    {serial.consignedToVenue}
                                  </div>
                                  <div className="text-[13px] text-[#8b8b9b]">out from {owner}</div>
                                </div>
                              )
                            })()}
                          </td>
                          <td className="px-4 py-[11px] text-[14.5px] font-medium text-[#17171c] hidden lg:table-cell">
                            {brandModel(serial.item)}
                          </td>
                          <td className="px-4 py-[11px] hidden lg:table-cell">
                            {serial.goodsReceiptLine?.goodsReceipt ? (
                              <Link
                                href={`/inventory/stock/reports/${serial.goodsReceiptLine.goodsReceipt.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className={`${MONO} text-[14px] text-[#5b21b6] hover:underline`}
                              >
                                {serial.goodsReceiptLine.goodsReceipt.code}
                              </Link>
                            ) : (
                              <span className={`${MONO} text-[14px] text-[#5b5b6b]`}>—</span>
                            )}
                            {serial.goodsReceiptLine?.goodsReceipt?.stockTransfer
                              ?.transferNumber && (
                              <div className={`${MONO} text-[13px] text-[#8b8b9b]`}>
                                ST{' '}
                                {serial.goodsReceiptLine.goodsReceipt.stockTransfer.transferNumber}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-[11px] text-[14.5px] text-[#5b5b6b] hidden lg:table-cell">
                            {originLabel(serial)}
                          </td>
                          <td className="px-4 py-[11px] text-[14.5px] text-[#8b8b9b] hidden md:table-cell">
                            {serial.goodsReceiptLine?.goodsReceipt?.receivedAt
                              ? formatShortDate(serial.goodsReceiptLine.goodsReceipt.receivedAt)
                              : '—'}
                          </td>
                          <td className="px-4 py-[11px] text-[13px] text-[#5b5b6b] hidden md:table-cell">
                            <SerialAges
                              firstReceivedAt={serial.firstReceivedAt}
                              locationSince={serial.locationSince}
                            />
                          </td>
                          <td className="px-4 py-[11px] text-center">
                            <div className="flex flex-col items-center gap-1">
                              <SerialStatusPill status={serial.status} />
                              {serial.openTransfer && (
                                <OpenTransferChip number={serial.openTransfer.transferNumber} />
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {pagination.total > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-[14px] text-[11.5px] text-[#8b8b9b]">
                <div className="flex items-center gap-[14px]">
                  <span>
                    Showing {(page - 1) * pagination.limit + 1}–
                    {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
                  </span>
                  <div className="flex items-center gap-[10px]">
                    <span>Rows</span>
                    <select
                      value={limit}
                      onChange={(e) => setLimit(Number(e.target.value))}
                      className="rounded-[7px] border border-[#d3d3db] bg-white px-[9px] py-1.5 text-[12px] text-[#3d3d4a]"
                    >
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>
                {pagination.totalPages > 1 && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page <= 1}
                      className="rounded-[7px] border border-[#e4e4e9] bg-white px-[11px] py-1.5 text-[12px] text-[#17171c] disabled:text-[#a3a3b2]"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1.5 font-medium text-[#17171c]">
                      {page} / {pagination.totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                      disabled={page >= pagination.totalPages}
                      className="rounded-[7px] border border-[#d3d3db] bg-white px-[11px] py-1.5 text-[12px] text-[#17171c] hover:border-[#a3a3b2] disabled:text-[#a3a3b2]"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <RegisterSerialsModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSubmit={registerSerials}
        isSubmitting={isRegistering}
        items={itemOptions.filter((i) => i.isSerialTracked)}
        warehouses={warehouseOptions}
      />

      <ImportSerializedInventoryModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        warehouses={warehouseOptions}
      />

      <ConsignToCaravanModal
        isOpen={isConsignOpen}
        onClose={() => setIsConsignOpen(false)}
        onSubmit={consignToCaravan}
        isSubmitting={isConsigning}
        serials={selection.selected}
        sourceId={selection.sourceWarehouse?.id ?? ''}
        sourceLabel={locationLabel(selection.sourceWarehouse)}
        warehouses={warehouseOptions}
        currentUserBranchId={session.branchId}
      />
    </div>
  )
}
