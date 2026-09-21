'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Hash, RefreshCw, X, Truck, Search, Copy, Check } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import { useSerialNumbers } from '../_hooks/useSerialNumbers'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import {
  SERIAL_STATUS_LABELS,
  SERIAL_STATUS_COLORS,
  SERIAL_STATUS_DOT_COLORS,
  SerialStatusSchema,
  type SerialStatus,
} from '@/src/schema/inventory/serial-numbers'
import RegisterSerialsModal from './RegisterSerialsModal'
import ImportSerializedInventoryModal from './ImportSerializedInventoryModal'
import ConsignToBranchModal from './ConsignToBranchModal'
import CaravanItemTable from './CaravanItemTable'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import Tooltip from '@/src/components/ui/Tooltip'
import { StatusBadge } from '@/src/components/ui/StatusBadge'
import { PLEX, MONO } from '../../purchase-orders/_components/procurementTokens'
import { formatShortDate } from '@/src/libs/format/date'
import { originLabel } from '@/src/libs/format/serial-provenance'
import { displayClassificationLabel } from '@/src/libs/format/text'
import { locationLabel } from '@/src/libs/format/locationLabel'
import type { ConsignToBranchFormValues } from '@/src/schema/inventory/serial-numbers'

// ─── Design tokens ────────────────────────────────────────────────────────────
// Matches Stock Balance's own #5b21b6 palette (same StockHub tab group), so
// the two lists in the Stock hub read as one design language.

const statusOptions = SerialStatusSchema.options

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

function CopySerialButton({ serialNumber }: { serialNumber: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard?.writeText(serialNumber)
    showToast({ title: `${serialNumber} copied`, status: 'success' })
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Tooltip label={copied ? 'Copied' : 'Copy serial number'}>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy serial number"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[#a3a3b2] hover:bg-[#f1ebfb] hover:text-[#3f1490]"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </Tooltip>
  )
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

export default function SerialNumberList({ session }: { session: SessionUser }) {
  const canManage = hasPermission(session, INVENTORY_PERMISSIONS.SERIAL_MANAGE)
  const canManageCaravan = hasPermission(session, INVENTORY_PERMISSIONS.CARAVAN_MANAGE)
  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isConsignOpen, setIsConsignOpen] = useState(false)
  const [moveTargetBranchId, setMoveTargetBranchId] = useState('')

  const {
    serials,
    pagination,
    statusCounts,
    isLoading,
    isFetching,
    error,
    statusFilter,
    categoryFilter: _categoryFilter,
    brandFilter,
    warehouseFilter,
    search,
    setStatusFilter,
    setBrandFilter,
    setWarehouseFilter,
    setSearch,
    resetFilters,
    page,
    setPage,
    limit,
    setLimit,
    warehouseOptions,
    itemOptions,
    branchOptions,
    registerSerials,
    isRegistering,
    refetch,
    caravanView,
    setCaravanView,
    caravanBranchId,
    setCaravanBranchId,
    caravanReady,
    caravanGrouping,
    setCaravanGrouping,
    caravanGroups,
    expandedGroupKey,
    toggleExpandedGroup,
    expandedSerials,
    isLoadingExpandedSerials,
    selectedIds,
    toggleSelected,
    toggleSelectAll,
    closeConsignment,
    isClosingConsignment,
    consignToBranch,
    isConsigning,
  } = useSerialNumbers()

  const brandOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const item of itemOptions) {
      if (item.brand?.id && !seen.has(item.brand.id)) seen.set(item.brand.id, item.brand.name)
    }
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }, [itemOptions])

  // The Caravan tab's "By Item" rollup — group rows, not serial rows, so the
  // serial-level bulk actions and the serial table both stand down for it.
  const groupedCaravan = caravanView && caravanGrouping === 'item'

  const hasFilters = statusFilter || warehouseFilter || search || brandFilter
  const showSelection = canManageCaravan

  const handleReturnToOrigin = async () => {
    await closeConsignment(undefined)
  }

  const handleMoveOnward = async () => {
    if (!moveTargetBranchId) return
    await closeConsignment(moveTargetBranchId)
    setMoveTargetBranchId('')
  }

  const handleConsignSubmit = async (data: ConsignToBranchFormValues) => consignToBranch(data)

  const soldReturned = statusCounts.sold + statusCounts.returned

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
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 rounded-lg border border-[#d3d3db] bg-white px-3 py-[9px] text-[13px] font-medium text-[#5b21b6] hover:bg-[#f1ebfb] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
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
          <div className="grid grid-cols-2 divide-x divide-y divide-[#eeeef1] overflow-hidden rounded-xl border border-[#e4e4e9] bg-white min-[640px]:grid-cols-3 min-[1080px]:grid-cols-5 min-[1080px]:divide-y-0">
            <MetricCell label="Registered" value={pagination.total} sub="total units" />
            <MetricCell
              label="In Stock"
              value={statusCounts.in_stock}
              sub="available to sell"
              highlight
            />
            <MetricCell label="Reserved" value={statusCounts.held} sub="committed" />
            <MetricCell label="Pulled Out" value={statusCounts.pulled_out} sub="repossessed" />
            <MetricCell label="Sold / Returned" value={soldReturned} sub="out of stock" />
          </div>
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

        {/* Scenario 08 (Caravan) — "By Serial" vs "By Item". Serials lead, in
            both order and default: this is the Serial Number Tracking page,
            and the unit-level actions live on that list. The item rollup is
            the summary you switch to. */}
        {caravanView && (
          <div className="flex w-fit gap-1 rounded-lg border border-[#e4e4e9] bg-white p-1">
            {(['serial', 'item'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCaravanGrouping(mode)}
                className={`rounded-[6px] px-3 py-1.5 text-[12.5px] font-medium ${
                  caravanGrouping === mode
                    ? 'bg-[#f1ebfb] text-[#3f1490]'
                    : 'text-[#5b5b6b] hover:text-[#17171c]'
                }`}
              >
                {mode === 'item' ? 'By Item' : 'By Serial'}
              </button>
            ))}
          </div>
        )}

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-[10px] rounded-xl border border-[#e4e4e9] bg-white p-3">
          <div
            className={`flex h-[38px] min-w-[220px] flex-[1_1_280px] items-center gap-[9px] rounded-lg border px-3 transition-colors ${CONTROL_CHROME.idle} focus-within:border-[#5b21b6] focus-within:shadow-[0_0_0_3px_#f0e9fc]`}
          >
            <Search className="h-3.25 w-3.25 shrink-0 text-[#8b8b9b]" />
            <input
              value={search ?? ''}
              onChange={(e) => setSearch(e.target.value || undefined)}
              placeholder="Search serial, model, RR, or supplier…"
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
            options={statusOptions.map((s) => ({ value: s, label: SERIAL_STATUS_LABELS[s] }))}
          />

          {caravanView ? (
            !session.branchId && (
              <SearchableSelect
                className="w-[190px]"
                value={caravanBranchId ?? ''}
                onChange={(v) => setCaravanBranchId(v || undefined)}
                placeholder="All branches"
                chrome={CONTROL_CHROME}
                clearable
                options={branchOptions.map((b) => ({ value: b.id, label: b.name }))}
              />
            )
          ) : (
            <SearchableSelect
              className="w-[190px]"
              value={warehouseFilter ?? ''}
              onChange={(v) => setWarehouseFilter(v || undefined)}
              placeholder="All locations"
              chrome={CONTROL_CHROME}
              clearable
              options={warehouseOptions.map((wh) => ({ value: wh.id, label: locationLabel(wh) }))}
            />
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

        {showSelection && !caravanView && selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-[9px] border border-[#ddd0f7] bg-[#f1ebfb] p-3">
            <span className="text-[12.5px] font-medium text-[#3f1490]">
              {selectedIds.size} selected
            </span>
            <button
              type="button"
              onClick={() => setIsConsignOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#5b21b6] px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#4c1a9b]"
            >
              <Truck className="h-3.5 w-3.5" />
              Consign for Caravan
            </button>
          </div>
        )}

        {showSelection && caravanView && !groupedCaravan && selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-[9px] border border-[#ddd0f7] bg-[#f1ebfb] p-3">
            <span className="text-[12.5px] font-medium text-[#3f1490]">
              {selectedIds.size} selected
            </span>
            <button
              type="button"
              onClick={handleReturnToOrigin}
              disabled={isClosingConsignment}
              className="rounded-lg bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#5b21b6] shadow-sm hover:bg-[#f1ebfb] disabled:opacity-50"
            >
              Return to Origin
            </button>
            <div className="flex items-center gap-2">
              <SearchableSelect
                className="min-w-40"
                value={moveTargetBranchId}
                onChange={setMoveTargetBranchId}
                placeholder="Move to…"
                chrome={CONTROL_CHROME}
                options={branchOptions
                  .filter((b) => b.id !== caravanBranchId)
                  .map((b) => ({ value: b.id, label: b.name }))}
              />
              <button
                type="button"
                onClick={handleMoveOnward}
                disabled={!moveTargetBranchId || isClosingConsignment}
                className="rounded-lg bg-[#5b21b6] px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#4c1a9b] disabled:opacity-50"
              >
                Move
              </button>
            </div>
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
              ) : groupedCaravan ? (
                <CaravanItemTable
                  groups={caravanGroups}
                  isBranchScoped={!!(caravanBranchId || session.branchId)}
                  expandedGroupKey={expandedGroupKey}
                  onToggleGroup={toggleExpandedGroup}
                  expandedSerials={expandedSerials}
                  isLoadingExpandedSerials={isLoadingExpandedSerials}
                />
              ) : serials.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-11 text-center">
                  <Hash className="h-[30px] w-[30px] text-[#c9c9d3]" />
                  {caravanView ? (
                    <div className="mt-1 text-[14px] font-semibold">
                      {caravanBranchId || session.branchId
                        ? 'Nothing currently consigned to this branch'
                        : 'Nothing currently out on caravan'}
                    </div>
                  ) : hasFilters ? (
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
                              aria-label="Select all"
                              checked={selectedIds.size > 0 && selectedIds.size === serials.length}
                              onChange={toggleSelectAll}
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
                        {caravanView && <th className="px-4 py-[9px] text-left">Home Branch</th>}
                        {caravanView && <th className="px-4 py-[9px] text-left">Event</th>}
                        <th className="px-4 py-[9px] text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f4f4f6]">
                      {serials.map((serial) => (
                        <tr
                          key={serial.id}
                          className={`hover:bg-[#fcfcfd] ${
                            selectedIds.has(serial.id) ? 'bg-[#f8f4fd]' : ''
                          }`}
                        >
                          {showSelection && (
                            <td className="px-4 py-[11px]">
                              <input
                                type="checkbox"
                                aria-label={`Select ${serial.serialNumber}`}
                                checked={selectedIds.has(serial.id)}
                                onChange={() => toggleSelected(serial.id)}
                                className="h-4 w-4 rounded border-zinc-300 text-[#5b21b6] focus:ring-[#5b21b6]"
                              />
                            </td>
                          )}
                          <td className="px-4 py-[11px]">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`${MONO} text-[14.5px] font-semibold text-[#17171c]`}
                                >
                                  {serial.serialNumber}
                                </span>
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
                              const owner = wh?.branch?.name ?? wh?.name ?? '—'
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
                          {caravanView && (
                            <td className="px-4 py-[11px]">
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#fdf3e7] px-2.5 py-0.5 text-[13px] font-medium text-[#8a4b06]">
                                {locationLabel(serial.currentWarehouse)}
                              </span>
                            </td>
                          )}
                          {caravanView && (
                            <td className="px-4 py-[11px] text-[14.5px] text-[#5b5b6b]">
                              <div>{serial.caravanEventName ?? '—'}</div>
                              {(serial.caravanEventStartDate || serial.caravanEventEndDate) && (
                                <div className="text-[13px] text-[#8b8b9b]">
                                  {serial.caravanEventStartDate
                                    ? formatShortDate(serial.caravanEventStartDate)
                                    : '—'}
                                  {' – '}
                                  {serial.caravanEventEndDate
                                    ? formatShortDate(serial.caravanEventEndDate)
                                    : '—'}
                                </div>
                              )}
                            </td>
                          )}
                          <td className="px-4 py-[11px] text-center">
                            <SerialStatusPill status={serial.status} />
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

      <ConsignToBranchModal
        isOpen={isConsignOpen}
        onClose={() => setIsConsignOpen(false)}
        onSubmit={handleConsignSubmit}
        isSubmitting={isConsigning}
        selectedCount={selectedIds.size}
        branches={branchOptions}
      />
    </div>
  )
}
