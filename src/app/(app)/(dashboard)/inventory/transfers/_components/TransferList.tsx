'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Plus, RefreshCw, X, ArrowRight, Search } from 'lucide-react'
import { useTransferManager } from '../_hooks/useTransferManager'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { TransferStatus, TransferSummary } from '@/src/schema/inventory/transfers'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { CONTROL_CHROME, MONO, PLEX } from '../../purchase-orders/_components/procurementTokens'
import CreateTransferModal from './CreateTransferModal'
import TransferDetailModal from './TransferDetailModal'
import { STATUS_CONFIG, StatusChip, branchLabel } from './transferStatus'

// The five stages the design tracks: the three live ones plus both terminal
// outcomes, so the band reads as the whole life of a transfer rather than
// only the part still needing a hand.
const PIPELINE_STATUSES: { status: TransferStatus; note: string }[] = [
  { status: 'requested', note: 'awaiting approval' },
  { status: 'draft', note: 'ready to dispatch' },
  { status: 'in_transit', note: 'on the road' },
  { status: 'received', note: 'closed' },
  { status: 'rejected', note: 'no stock moved' },
]

const PRIMARY_PILL_STATUSES: TransferStatus[] = [
  'requested',
  'draft',
  'in_transit',
  'received',
  'rejected',
]

// Shown only when something is actually in them. They are real states the
// backend can put a transfer in, so hiding them outright would make those
// rows impossible to filter to — but showing four permanently-zero pills
// would bury the five that matter.
const SECONDARY_PILL_STATUSES: TransferStatus[] = [
  'pending_manager_approval',
  'pending_hq_approval',
  'partially_received',
  'cancelled',
]

function lineTotals(lines: TransferSummary['lines']): { total: number; received: number } {
  if (!lines || !lines.length) return { total: 0, received: 0 }
  return {
    total: lines.reduce((sum, l) => sum + Number(l.quantity), 0),
    received: lines.reduce((sum, l) => sum + Number(l.receivedQuantity ?? 0), 0),
  }
}

function TransferProgress({ lines }: { lines: TransferSummary['lines'] }) {
  const { total, received } = lineTotals(lines)
  if (!total) return <span className="text-[#c9c9d3]">—</span>
  const pct = Math.min((received / total) * 100, 100)
  const fill = pct >= 100 ? 'bg-[#0f7b52]' : pct > 0 ? 'bg-[#d18b1d]' : 'bg-[#e4e4e9]'
  const tone = pct >= 100 ? 'text-[#0b6644]' : pct > 0 ? 'text-[#8a4b06]' : 'text-[#8b8b9b]'
  return (
    <div className="flex w-[140px] flex-col gap-[5px]">
      <div className="h-[5px] overflow-hidden rounded-[3px] bg-[#eeeef1]">
        <div
          className={`h-full rounded-[3px] transition-all duration-500 ${fill}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <span className={`${MONO} text-[10px] ${tone}`}>
        {received.toFixed(0)} of {total.toFixed(0)} received
      </span>
    </div>
  )
}

// How long the transfer has been sitting where it is. A transfer waiting on
// somebody's action reads as stale much sooner than one already on the road,
// so the threshold differs per stage.
const STALE_AFTER_DAYS: Partial<Record<TransferStatus, number>> = {
  pending_manager_approval: 1,
  requested: 1,
  pending_hq_approval: 1,
  draft: 1,
  in_transit: 2,
}

function daysSince(iso: string | undefined): number | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000))
}

function TransferAge({ transfer }: { transfer: TransferSummary }) {
  const days = daysSince(transfer.transferDate ?? transfer.createdAt)
  if (days === null) return <span className="text-[#c9c9d3]">—</span>
  const threshold = STALE_AFTER_DAYS[transfer.status]
  const stale = threshold !== undefined && days >= threshold
  return (
    <div className="flex flex-col gap-px">
      <span
        className={`${MONO} text-[12.5px] ${stale ? 'font-semibold text-[#8a4b06]' : 'text-[#3d3d4a]'}`}
      >
        {days} {days === 1 ? 'day' : 'days'}
      </span>
      <span className="text-[10px] text-[#5b5b6b]">{stale ? 'needs action' : 'since raised'}</span>
    </div>
  )
}

/** Scenario 56 — the transfer as the viewer's own branch sees it: Incoming
 * when it's the requesting (destination) branch, Outgoing when it's the one
 * supplying. Null for a viewer with no branch (Business Owner) or a transfer
 * between two other branches. */
function directionFor(
  transfer: TransferSummary,
  viewerBranchId: string | null | undefined
): 'incoming' | 'outgoing' | null {
  if (!viewerBranchId) return null
  const branchOf = (wh: TransferSummary['toWarehouse']): string | null | undefined =>
    wh?.branch?.id ?? wh?.branchId
  if (branchOf(transfer.toWarehouse) === viewerBranchId) return 'incoming'
  if (branchOf(transfer.fromWarehouse) === viewerBranchId) return 'outgoing'
  return null
}

function DirectionTag({
  direction,
}: {
  direction: 'incoming' | 'outgoing' | null
}): React.ReactElement | null {
  if (!direction) return null
  return (
    <span
      className={`shrink-0 rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-medium ${
        direction === 'incoming' ? 'bg-[#e3f4f2] text-[#0f7566]' : 'bg-[#fdf3e7] text-[#8a4b06]'
      }`}
      title={
        direction === 'incoming'
          ? 'Your branch requested this stock'
          : 'Your branch is supplying this stock'
      }
    >
      {direction === 'incoming' ? 'Incoming' : 'Outgoing'}
    </span>
  )
}

export default function TransferList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.TRANSFERS_CREATE)
  const canAccept = hasPermission(session, INVENTORY_PERMISSIONS.TRANSFERS_ACCEPT)
  const canReject = hasPermission(session, INVENTORY_PERMISSIONS.TRANSFERS_REJECT)
  const canDispatch = hasPermission(session, INVENTORY_PERMISSIONS.TRANSFERS_DISPATCH)
  const canOverrideSerial = hasPermission(session, INVENTORY_PERMISSIONS.TRANSFERS_SERIAL_OVERRIDE)
  const canReceive = hasPermission(session, INVENTORY_PERMISSIONS.TRANSFERS_RECEIVE)
  const canHqApprove = hasPermission(session, INVENTORY_PERMISSIONS.TRANSFERS_HQ_APPROVE)
  const canHqReject = hasPermission(session, INVENTORY_PERMISSIONS.TRANSFERS_HQ_REJECT)
  const canManagerApprove = hasPermission(session, INVENTORY_PERMISSIONS.TRANSFERS_MANAGER_APPROVE)
  const canManagerReject = hasPermission(session, INVENTORY_PERMISSIONS.TRANSFERS_MANAGER_REJECT)
  const canSkipApproval = hasPermission(session, INVENTORY_PERMISSIONS.TRANSFERS_DIRECT)
  const canUpdate = hasPermission(session, INVENTORY_PERMISSIONS.TRANSFERS_UPDATE)

  const {
    transfers,
    pagination,
    isLoading,
    isFetching,
    error,
    statusFilter,
    fromWarehouseFilter,
    toWarehouseFilter,
    search,
    setSearch,
    setStatusFilter,
    setFromWarehouseFilter,
    setToWarehouseFilter,
    resetFilters,
    page,
    setPage,
    selectedTransfer,
    setSelectedTransfer,
    transferDetail,
    isLoadingDetail,
    warehouseOptions,
    branchOptions,
    statusCounts,
    totalCount,
    createTransfer,
    updateTransfer,
    isUpdating,
    consignUnits,
    isConsigning,
    isCreating,
    approveHqTransfer,
    isApprovingHq,
    rejectHqTransfer,
    isRejectingHq,
    approveManagerTransfer,
    isApprovingManager,
    rejectManagerTransfer,
    isRejectingManager,
    acceptTransfer,
    isAccepting,
    rejectTransfer,
    isRejecting,
    dispatchTransfer,
    isDispatching,
    receiveTransfer,
    isReceiving,
    cancelTransfer,
    isCancelling,
    refetch,
  } = useTransferManager()

  // accept/reject/dispatch are source-branch-only and receive is
  // destination-branch-only on the backend — a Branch Manager can hold the
  // permission in general but still not be the right branch for a given row,
  // so the row action here must match what the detail panel actually allows.
  const currentUserRegion = branchOptions.find((b) => b.id === session.branchId)?.region ?? null
  const inScope = (warehouseBranchId: string | null | undefined, warehouseRegion?: string | null) =>
    !session.branchId ||
    warehouseBranchId === session.branchId ||
    (warehouseBranchId === null && warehouseRegion === currentUserRegion)

  // One action per row instead of a cluster of per-status buttons. The row
  // always offers something — it falls back to "View" — so the column never
  // renders an empty cell.
  function rowAction(tr: TransferSummary): { label: string; primary: boolean } {
    const fromInScope = inScope(tr.fromWarehouse?.branchId, tr.fromWarehouse?.region)
    const toInScope = inScope(tr.toWarehouse?.branchId, tr.toWarehouse?.region)

    if (
      tr.status === 'pending_manager_approval' &&
      (canManagerApprove || canManagerReject) &&
      toInScope
    )
      return { label: 'Review', primary: true }
    if (tr.status === 'pending_hq_approval' && (canHqApprove || canHqReject))
      return { label: 'Review', primary: true }
    if (tr.status === 'requested' && (canAccept || canReject) && fromInScope)
      return { label: 'Review', primary: true }
    if (tr.status === 'draft' && canDispatch && fromInScope)
      return { label: 'Dispatch', primary: true }
    if (tr.status === 'in_transit' && canReceive && toInScope)
      return { label: 'Mark received', primary: true }
    if (tr.status === 'partially_received' && canReceive && toInScope)
      return { label: 'Receive more', primary: true }

    return { label: 'View', primary: false }
  }

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  // The transfer being edited. Non-null turns the same create screen into an
  // edit of this request — the two build the identical payload, so they share
  // one form rather than keeping a near-duplicate of a 1300-line component.
  const [editingTransfer, setEditingTransfer] = useState<TransferSummary | null>(null)
  const [searchFocused, setSearchFocused] = useState(false)
  const [createDraft, setCreateDraft] = useState<{
    fromWarehouseId: string
    itemId: string
    itemLabel?: string
    quantity: number
  } | null>(null)

  // Item 360's Stock tab "Request transfer" deep-links here with a source
  // warehouse, an item and how many units — read once on mount, open straight
  // into a pre-filled create form, then strip the params so a refresh or Back
  // doesn't silently reopen it. Which physical units ship is decided by the
  // source at dispatch, so only a count travels, never serial ids.
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  useEffect(() => {
    const fromWarehouseId = searchParams.get('prefillFromWarehouseId')
    const itemId = searchParams.get('prefillItemId')
    const quantity = Number(searchParams.get('prefillQty') ?? '1')
    if (fromWarehouseId && itemId && quantity > 0) {
      setCreateDraft({
        fromWarehouseId,
        itemId,
        itemLabel: searchParams.get('prefillItemLabel') ?? undefined,
        quantity,
      })
      setIsCreateOpen(true)
      router.replace('/inventory/transfers')
      return
    }

    // `?new=1` — the same "open straight into the create form" idea without a
    // prefill, for links whose label is the verb: Item 360's "Transfer"
    // button. Landing someone on a list of past transfers and asking them to
    // find "New transfer" makes a button that says Transfer not transfer.
    //
    // Stripped relative to the current path rather than to
    // /inventory/transfers like the prefill branch above, because this list is
    // mounted at two routes — its own, and /inventory/operations?tab=transfers
    // — and a hardcoded replace would move the user off whichever one they
    // came in on.
    if (searchParams.get('new') === '1' && canCreate) {
      setIsCreateOpen(true)
      const next = new URLSearchParams(searchParams.toString())
      next.delete('new')
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
    // Deliberately mount-only — the params are consumed once, then stripped;
    // re-running on every searchParams/router identity change would refight
    // that strip and never let the modal close normally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Deep link into one transfer — `?transfer=TRF-…`, as the receiving report
  // that arrived on it links here. Transfers have no per-transfer route (the
  // detail is a modal over this list), so the number is resolved in two
  // steps: seed the search box on mount so the list actually contains the
  // row, then open it once the matching row has loaded.
  const deepLinkNumber = searchParams.get('transfer')
  const [deepLinkOpened, setDeepLinkOpened] = useState(false)
  useEffect(() => {
    if (deepLinkNumber) setSearch(deepLinkNumber)
    // Mount-only, for the same reason the prefill effect above is: the param
    // is consumed once and then stripped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!deepLinkNumber || deepLinkOpened) return
    const match = transfers.find((t) => t.transferNumber === deepLinkNumber)
    if (!match) return
    setSelectedTransfer(match)
    setDeepLinkOpened(true)
    // Stripped so a refresh or Back doesn't silently reopen the modal, same
    // as the create-prefill params.
    router.replace('/inventory/transfers')
  }, [deepLinkNumber, deepLinkOpened, transfers, setSelectedTransfer, router])

  function openDetail(transfer: TransferSummary) {
    setSelectedTransfer(transfer)
  }

  function toggleStatus(status: TransferStatus) {
    setStatusFilter(statusFilter === status ? undefined : status)
  }

  const hasFilters = !!(
    statusFilter ||
    fromWarehouseFilter.length ||
    toWarehouseFilter.length ||
    search
  )
  const pillStatuses = [
    ...PRIMARY_PILL_STATUSES,
    ...SECONDARY_PILL_STATUSES.filter((st) => (statusCounts[st] ?? 0) > 0),
  ]
  const locationOptions = warehouseOptions.map((wh) => ({
    value: wh.id,
    label: branchLabel(wh),
  }))
  const th = `${MONO} px-[18px] py-[10px] text-[10px] font-semibold uppercase tracking-[0.09em] text-[#5b5b6b]`

  return (
    <div className={`${PLEX} min-h-full w-full bg-zinc-50 text-[#17171c] antialiased`}>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-[14px] px-[22px] pb-[26px] pt-[18px]">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Stock Transfers</h1>
            <p className="text-[13px] text-[#5b5b6b]">
              Move stock between branches with full ledger traceability.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-[9px]">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-[7px] rounded-lg border border-[#d3d3db] bg-white px-[14px] py-[9px] text-[13px] font-medium text-[#17171c] hover:border-[#a3a3b2] hover:bg-[#faf9fb] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {canCreate && (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-[7px] rounded-lg bg-[#5b21b6] px-[15px] py-[9px] text-[13px] font-semibold text-white hover:bg-[#4a189b]"
              >
                <Plus className="h-3.5 w-3.5" />
                New transfer
              </button>
            )}
          </div>
        </div>

        {/* Pipeline band */}
        <div className="grid grid-cols-2 overflow-hidden rounded-[10px] border border-[#e4e4e9] bg-white lg:grid-cols-5">
          {PIPELINE_STATUSES.map(({ status, note }, i) => {
            const cfg = STATUS_CONFIG[status]
            const Icon = cfg.icon
            const count = statusCounts[status] ?? 0
            const active = statusFilter === status
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatus(status)}
                className={`flex flex-col gap-1 px-[15px] py-[13px] text-left transition-colors ${
                  active
                    ? 'bg-[#faf7ff] shadow-[inset_0_-2px_0_#5b21b6]'
                    : 'bg-white hover:bg-[#fbfbfc]'
                } ${i > 0 ? 'border-l border-[#eeeef1]' : ''}`}
              >
                <span className="flex items-center gap-[7px]">
                  <Icon className={`h-[13px] w-[13px] shrink-0 ${cfg.tone}`} />
                  <span
                    className={`${MONO} text-[10px] uppercase tracking-[0.08em] text-[#5b5b6b]`}
                  >
                    {cfg.label}
                  </span>
                </span>
                <span
                  className={`${MONO} text-[20px] font-semibold tracking-[-0.02em] ${
                    count === 0 ? 'text-[#a3a3b2]' : 'text-[#17171c]'
                  }`}
                >
                  {count}
                </span>
                <span className="text-[11px] text-[#5b5b6b]">{note}</span>
              </button>
            )
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-[9px]">
          <div
            className={`flex min-w-[220px] max-w-[400px] flex-1 items-center gap-[9px] rounded-lg bg-white px-3 py-[9px] ${
              searchFocused ? `border ${CONTROL_CHROME.focused}` : `border ${CONTROL_CHROME.idle}`
            }`}
          >
            <Search className="h-[13px] w-[13px] shrink-0 text-[#8b8b9b]" />
            <input
              type="text"
              placeholder="Search transfer #, item, SKU, or serial…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full min-w-0 border-none bg-transparent text-[13px] text-[#17171c] outline-none placeholder:text-[#a3a3b2]"
            />
            {!!search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="shrink-0 text-[12px] text-[#8b8b9b] hover:text-[#5b5b6b]"
              >
                clear
              </button>
            )}
          </div>

          {/* Type-ahead pickers rather than native <select>s, same control and
              chrome the Purchase Orders toolbar uses — a tenant runs dozens of
              branches, and scrolling a native list is the slow way to a known
              name. */}
          <SearchableSelect
            multiple
            className="w-[190px]"
            value={fromWarehouseFilter}
            onChange={setFromWarehouseFilter}
            placeholder="All sources"
            summaryNoun="sources"
            chrome={CONTROL_CHROME}
            clearable
            options={locationOptions}
          />

          <SearchableSelect
            multiple
            className="w-[190px]"
            value={toWarehouseFilter}
            onChange={setToWarehouseFilter}
            placeholder="All destinations"
            summaryNoun="destinations"
            chrome={CONTROL_CHROME}
            clearable
            options={locationOptions}
          />

          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 rounded-lg px-3 py-[9px] text-[12.5px] text-[#5b21b6] hover:bg-[#f1ebfb]"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}
        </div>

        {/* Status pills */}
        <div className="-mx-1 flex flex-wrap items-center gap-2 px-1">
          <button
            type="button"
            onClick={() => setStatusFilter(undefined)}
            className={`flex shrink-0 items-center gap-[7px] rounded-[20px] px-3 py-[7px] text-[12.5px] transition-colors ${
              !statusFilter
                ? 'border border-[#5b21b6] bg-[#5b21b6] font-medium text-white'
                : 'border border-[#e4e4e9] bg-white text-[#3d3d4a] hover:bg-[#fbfbfc]'
            }`}
          >
            All
            <span
              className={`${MONO} text-[10.5px] ${!statusFilter ? 'text-[#ddd0f7]' : 'text-[#8b8b9b]'}`}
            >
              {totalCount}
            </span>
          </button>
          {pillStatuses.map((status) => {
            const cfg = STATUS_CONFIG[status]
            const Icon = cfg.icon
            const active = statusFilter === status
            const count = statusCounts[status] ?? 0
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatus(status)}
                className={`flex shrink-0 items-center gap-[7px] rounded-[20px] px-3 py-[7px] text-[12.5px] transition-colors ${
                  active
                    ? 'border border-[#5b21b6] bg-[#5b21b6] font-medium text-white'
                    : `border border-[#e4e4e9] bg-white hover:bg-[#fbfbfc] ${
                        count === 0 ? 'text-[#a3a3b2]' : 'text-[#3d3d4a]'
                      }`
                }`}
              >
                <Icon className={`h-[13px] w-[13px] shrink-0 ${active ? '' : cfg.tone}`} />
                {cfg.label}
                <span
                  className={`${MONO} text-[10.5px] ${active ? 'text-[#ddd0f7]' : 'text-[#8b8b9b]'}`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-[#f3c9c5] bg-[#fdeceb] p-4">
            <p className="text-[13px] font-medium text-[#b42318]">Failed to load transfers</p>
          </div>
        )}

        {/* Table */}
        <div
          className={`overflow-hidden rounded-xl border border-[#e4e4e9] bg-white transition-opacity ${
            isFetching ? 'opacity-60' : ''
          }`}
        >
          {isLoading ? (
            <div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-[#f4f4f6] px-[18px] py-[13px] last:border-0"
                >
                  <div className="h-4 w-24 animate-pulse rounded bg-[#eeeef1]" />
                  <div className="h-4 w-40 animate-pulse rounded bg-[#eeeef1]" />
                  <div className="ml-auto h-4 w-16 animate-pulse rounded bg-[#eeeef1]" />
                  <div className="h-4 w-20 animate-pulse rounded bg-[#eeeef1]" />
                </div>
              ))}
            </div>
          ) : transfers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-[46px] text-center">
              <div className="h-[30px] w-[30px] rounded-lg border border-[#e4e4e9] bg-[#fbfbfc]" />
              {hasFilters ? (
                <>
                  <p className="mt-1 text-[14.5px] font-semibold">No transfers match</p>
                  <p className="max-w-[420px] text-[12.5px] leading-relaxed text-[#5b5b6b]">
                    {search
                      ? `Nothing matches “${search}”. Try the transfer number or an item SKU.`
                      : 'No transfers fall inside these filters. Clear one to see more.'}
                  </p>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-3 rounded-lg border border-[#d3d3db] bg-white px-[15px] py-[9px] text-[13px] font-medium text-[#17171c] hover:border-[#a3a3b2]"
                  >
                    Clear search and filters
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-1 text-[15px] font-semibold">No transfers yet</p>
                  <p className="max-w-[440px] text-[12.5px] leading-relaxed text-[#5b5b6b]">
                    Raise a transfer when a branch needs stock another branch is holding. Every
                    movement is written to the stock ledger.
                  </p>
                  {canCreate && (
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen(true)}
                      className="mt-3 rounded-lg bg-[#5b21b6] px-[15px] py-[9px] text-[13px] font-semibold text-white hover:bg-[#4a189b]"
                    >
                      + New transfer
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#eeeef1] bg-[#fbfbfc]">
                    <th className={`${th} text-left`}>Transfer</th>
                    <th className={`${th} text-left`}>Supplying → Requesting</th>
                    <th className={`${th} text-right`}>Items</th>
                    <th className={`${th} hidden text-left md:table-cell`}>Progress</th>
                    <th className={`${th} text-left`}>Status</th>
                    <th className={`${th} hidden text-left lg:table-cell`}>Age</th>
                    <th className={`${th} text-right`}>
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((tr) => {
                    const lineCount = tr._count?.lines ?? tr.lines?.length ?? 0
                    const { total: unitTotal } = lineTotals(tr.lines)
                    const action = rowAction(tr)

                    return (
                      <tr
                        key={tr.id}
                        onClick={() => openDetail(tr)}
                        className="cursor-pointer border-t border-[#f4f4f6] hover:bg-[#fbfbfc]"
                      >
                        <td className="px-[18px] py-[13px]">
                          <div className="flex flex-col gap-px">
                            <span className={`${MONO} text-[12.5px] font-semibold`}>
                              #{tr.id.slice(0, 8).toUpperCase()}
                            </span>
                            <span className="text-[11px] text-[#5b5b6b]">
                              {tr.transferDate
                                ? new Date(tr.transferDate).toLocaleDateString('en-PH', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })
                                : '—'}
                              {tr.requestedByName ? ` · ${tr.requestedByName}` : ''}
                            </span>
                          </div>
                        </td>
                        <td className="px-[18px] py-[13px]">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-[12.5px] text-[#5b5b6b]">
                              {branchLabel(tr.fromWarehouse)}
                            </span>
                            <ArrowRight className="h-3 w-3 shrink-0 text-[#c9c9d3]" />
                            <span className="truncate text-[12.5px] font-semibold">
                              {branchLabel(tr.toWarehouse)}
                            </span>
                            <DirectionTag direction={directionFor(tr, session.branchId)} />
                          </div>
                        </td>
                        <td className="px-[18px] py-[13px]">
                          <div className="flex flex-col items-end gap-px">
                            <span className={`${MONO} text-[13px] font-semibold`}>
                              {unitTotal > 0 ? unitTotal.toFixed(0) : lineCount}
                            </span>
                            <span className="text-[10px] text-[#5b5b6b]">
                              {lineCount} {lineCount === 1 ? 'line' : 'lines'}
                            </span>
                          </div>
                        </td>
                        <td className="hidden px-[18px] py-[13px] md:table-cell">
                          <TransferProgress lines={tr.lines} />
                        </td>
                        <td className="px-[18px] py-[13px]">
                          <StatusChip status={tr.status} />
                        </td>
                        <td className="hidden px-[18px] py-[13px] lg:table-cell">
                          <TransferAge transfer={tr} />
                        </td>
                        <td
                          className="px-[18px] py-[13px] text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => openDetail(tr)}
                            className={`w-[112px] rounded-[7px] px-[10px] py-[7px] text-[12.5px] font-medium transition-colors ${
                              action.primary
                                ? 'bg-[#5b21b6] text-white hover:bg-[#4a189b]'
                                : 'border border-[#e4e4e9] bg-white text-[#5b5b6b] hover:bg-[#fbfbfc]'
                            }`}
                          >
                            {action.label}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer — always present alongside rows so the result count stays
              visible even on a single page. */}
          {!isLoading && transfers.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-[14px] border-t border-[#e4e4e9] bg-[#fbfbfc] px-[18px] py-[11px]">
              <span className="text-[11.5px] text-[#5b5b6b]">
                Showing {transfers.length} of {pagination.total} transfers
              </span>
              {pagination.totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="rounded-[7px] border border-[#d3d3db] bg-white px-[11px] py-[6px] text-[12px] text-[#17171c] hover:border-[#a3a3b2] disabled:border-[#e4e4e9] disabled:text-[#a3a3b2]"
                  >
                    Previous
                  </button>
                  <span className="px-2 text-[12px] font-medium text-[#3d3d4a]">
                    {page} / {pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                    disabled={page >= pagination.totalPages}
                    className="rounded-[7px] border border-[#d3d3db] bg-white px-[11px] py-[6px] text-[12px] text-[#17171c] hover:border-[#a3a3b2] disabled:border-[#e4e4e9] disabled:text-[#a3a3b2]"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <CreateTransferModal
        isOpen={isCreateOpen || !!editingTransfer}
        onClose={() => {
          setIsCreateOpen(false)
          setCreateDraft(null)
          setEditingTransfer(null)
        }}
        // One screen, two destinations: the form produces the same complete
        // request either way, so which endpoint it goes to is the only thing
        // that changes. The modal itself stays unaware of the difference.
        onSubmit={
          editingTransfer ? (data) => updateTransfer(editingTransfer.id, data) : createTransfer
        }
        isSubmitting={editingTransfer ? isUpdating : isCreating}
        editing={editingTransfer}
        onConsign={consignUnits}
        isConsigning={isConsigning}
        warehouses={warehouseOptions}
        currentUserBranchId={session.branchId}
        canSkipApproval={canSkipApproval}
        initialDraft={createDraft}
      />

      <TransferDetailModal
        isOpen={!!selectedTransfer}
        transfer={transferDetail}
        isLoading={isLoadingDetail}
        onClose={() => setSelectedTransfer(null)}
        canAccept={canAccept}
        canReject={canReject}
        canDispatch={canDispatch}
        canOverrideSerial={canOverrideSerial}
        canReceive={canReceive}
        canHqApprove={canHqApprove}
        canHqReject={canHqReject}
        canManagerApprove={canManagerApprove}
        canManagerReject={canManagerReject}
        currentUserBranchId={session.branchId}
        currentUserRegion={currentUserRegion}
        onAccept={acceptTransfer}
        onReject={rejectTransfer}
        onDispatch={dispatchTransfer}
        onReceive={receiveTransfer}
        onCancel={cancelTransfer}
        canEdit={canUpdate}
        onEdit={(tr) => {
          // Close the detail panel first — the edit form is the same
          // full-content sheet, and leaving both mounted would stack two of
          // them over the page area.
          setSelectedTransfer(null)
          setEditingTransfer(tr)
        }}
        onApproveHq={approveHqTransfer}
        onRejectHq={rejectHqTransfer}
        onApproveManager={approveManagerTransfer}
        onRejectManager={rejectManagerTransfer}
        isAccepting={isAccepting}
        isRejecting={isRejecting}
        isDispatching={isDispatching}
        isReceiving={isReceiving}
        isCancelling={isCancelling}
        isApprovingHq={isApprovingHq}
        isRejectingHq={isRejectingHq}
        isApprovingManager={isApprovingManager}
        isRejectingManager={isRejectingManager}
      />
    </div>
  )
}
