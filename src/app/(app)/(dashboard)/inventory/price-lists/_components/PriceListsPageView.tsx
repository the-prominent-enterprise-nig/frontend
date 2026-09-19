'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Plus,
  RefreshCw,
  Search,
  Tag,
  Tags,
  Pencil,
  CheckCircle,
  XCircle,
  RotateCcw,
  ListChecks,
  Trash2,
} from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { RowActionsMenu, type RowMenuItem } from '@/src/components/ui/RowActionsMenu'
import Tooltip from '@/src/components/ui/Tooltip'
import { Select } from '@/src/components/ui/Select'
import { usePriceLists, type PriceListSort } from '../_hooks/usePriceLists'
import PriceListModal from './PriceListModal'
import { ApprovePriceListModal } from './ApprovePriceListModal'
import { RejectPriceListModal } from './RejectPriceListModal'
import { DeletePriceListModal } from './DeletePriceListModal'
import ManageCategoriesDrawer from './ManageCategoriesDrawer'
import {
  EDITABLE_STATUSES,
  DELETABLE_STATUSES,
  STATUS_LABELS,
  itemCountLabel,
  statusTone,
  branchScopeTooltip,
  branchScopeShort,
  effectiveSummary,
  coverage,
  THIN_COVERAGE_THRESHOLD,
} from '../_lib/price-list-format'
import type {
  ApprovePriceListFormValues,
  PriceList,
  PriceListFormValues,
  RejectPriceListFormValues,
} from '@/src/schema/inventory/price-lists'
import { PLEX, MONO } from '@/src/libs/design/plex'

type PriceListActionsProps = {
  pl: PriceList
  canUpdate: boolean
  canApprove: boolean
  canDelete: boolean
  isResubmitting: boolean
  justify?: 'start' | 'end'
  onEdit: () => void
  onApprove: () => void
  onReject: () => void
  onResubmit: () => void
  onDelete: () => void
}

// Shared between the desktop table row and the mobile card so the two
// layouts can't drift out of sync on which buttons show for which status.
// Only Manage Items (always relevant) and Approve/Reject (the one time-
// sensitive governance action) stay as direct buttons — Edit, Resubmit, and
// Delete collapse into an overflow menu so a pending list with full
// permissions doesn't cram icon buttons into one row.
function PriceListActions({
  pl,
  canUpdate,
  canApprove,
  canDelete,
  isResubmitting,
  justify = 'end',
  onEdit,
  onApprove,
  onReject,
  onResubmit,
  onDelete,
}: PriceListActionsProps) {
  const menuItems: RowMenuItem[] = [
    ...(canUpdate && EDITABLE_STATUSES.includes(pl.status)
      ? [{ label: 'Edit', icon: Pencil, onClick: onEdit }]
      : []),
    ...(pl.status === 'rejected' && canUpdate
      ? [
          {
            label: isResubmitting ? 'Resubmitting…' : 'Resubmit',
            icon: RotateCcw,
            onClick: onResubmit,
          },
        ]
      : []),
    ...(canDelete && DELETABLE_STATUSES.includes(pl.status)
      ? [{ label: 'Delete', icon: Trash2, onClick: onDelete, variant: 'danger' as const }]
      : []),
  ]

  return (
    <div
      className={`flex flex-nowrap items-center gap-1 whitespace-nowrap ${justify === 'end' ? 'justify-end' : 'justify-start'}`}
    >
      <Tooltip label="Manage Items" side="top" align="end">
        <Link
          href={`/inventory/price-lists/${pl.id}`}
          aria-label="Manage Items"
          className="rounded-lg p-1.5 text-[#5b5b6b] hover:bg-[#f1f1f4]"
        >
          <ListChecks className="h-4 w-4" />
        </Link>
      </Tooltip>
      {pl.status === 'pending_approval' && canApprove && (
        <>
          <Tooltip label="Approve" side="top" align="end">
            <button
              type="button"
              aria-label="Approve"
              onClick={onApprove}
              className="rounded-lg p-1.5 text-[#0b6644] hover:bg-[#e7f5ef]"
            >
              <CheckCircle className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip label="Reject" side="top" align="end">
            <button
              type="button"
              aria-label="Reject"
              onClick={onReject}
              className="rounded-lg p-1.5 text-[#b42318] hover:bg-[#fdeceb]"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </Tooltip>
        </>
      )}
      <RowActionsMenu items={menuItems} />
    </div>
  )
}

function StatusChip({ status }: { status: string }) {
  const tone = statusTone(status)
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium ${tone.chip}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

const SORT_OPTIONS: { value: PriceListSort; label: string }[] = [
  { value: 'items', label: 'Most items priced' },
  { value: 'priority', label: 'Highest priority' },
  { value: 'name', label: 'Name A–Z' },
]

export default function PriceListsPageView({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.PRICE_LISTS_CREATE)
  const canUpdate = hasPermission(session, INVENTORY_PERMISSIONS.PRICE_LISTS_UPDATE)
  const canApprove = hasPermission(session, INVENTORY_PERMISSIONS.PRICE_LISTS_APPROVE)
  const canDelete = hasPermission(session, INVENTORY_PERMISSIONS.PRICE_LISTS_DELETE)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingList, setEditingList] = useState<PriceList | undefined>(undefined)
  const [approvingList, setApprovingList] = useState<PriceList | null>(null)
  const [rejectingList, setRejectingList] = useState<PriceList | null>(null)
  const [deletingList, setDeletingList] = useState<PriceList | null>(null)
  const [isCategoriesDrawerOpen, setIsCategoriesDrawerOpen] = useState(false)

  const {
    priceLists,
    allPriceLists,
    catalogTotal,
    stats,
    filters,
    setFilters,
    resetFilters,
    hasActiveFilters,
    pagination,
    isLoading,
    isFetching,
    error,
    page,
    setPage,
    branches,
    priceUseTypes,
    createPriceUseType,
    isCreatingPriceUseType,
    createPriceList,
    isCreating,
    updatePriceList,
    isUpdating,
    approvePriceList,
    isApproving,
    rejectPriceList,
    isRejecting,
    resubmitPriceList,
    isResubmitting,
    deletePriceList,
    isDeleting,
    refetch,
  } = usePriceLists()

  function openCreateModal() {
    setEditingList(undefined)
    setIsModalOpen(true)
  }

  function openEditModal(list: PriceList) {
    setEditingList(list)
    setIsModalOpen(true)
  }

  async function handleSubmit(data: PriceListFormValues) {
    return editingList ? updatePriceList({ id: editingList.id, data }) : createPriceList(data)
  }

  async function handleApprove(id: string, data: ApprovePriceListFormValues) {
    await approvePriceList({ id, data })
  }

  async function handleReject(id: string, data: RejectPriceListFormValues) {
    await rejectPriceList({ id, data })
  }

  async function handleDelete(id: string) {
    await deletePriceList(id)
  }

  // Each tile is also the filter for what it counts — the number and the way
  // to go look at it are the same control, so nobody reads "3 rejected" and
  // then has to hunt for where the rejected ones are.
  const coverageTiles = [
    {
      key: 'active',
      label: 'Live now',
      value: stats.active,
      note: 'pricing at the till',
      dot: 'bg-[#0f7b52]',
      status: 'active',
    },
    {
      key: 'pending_approval',
      label: 'Waiting on approval',
      value: stats.pending,
      note: 'not applying yet',
      dot: 'bg-[#d18b1d]',
      status: 'pending_approval',
    },
    {
      key: 'thin',
      label: 'Thin coverage',
      value: stats.thinCoverage,
      note: catalogTotal
        ? `live lists under ${THIN_COVERAGE_THRESHOLD}% of catalog`
        : 'catalog size unavailable',
      dot: 'bg-orange-400',
      // No status of its own — thin coverage is a property of live lists, so
      // the tile narrows to those and leaves the reading to the Items column.
      status: 'active',
    },
    {
      key: 'retired',
      label: 'Not selling',
      value: stats.retired,
      note: 'inactive or expired',
      dot: 'bg-[#a3a3b2]',
      status: 'inactive',
    },
  ]

  const statusPills = [
    { value: 'all', label: 'All', count: stats.total },
    { value: 'active', label: 'Active', count: stats.active },
    { value: 'pending_approval', label: 'Pending', count: stats.pending },
    { value: 'rejected', label: 'Rejected', count: stats.rejected },
    {
      value: 'inactive',
      label: 'Inactive',
      count: allPriceLists.filter((p) => p.status === 'inactive').length,
    },
    {
      value: 'expired',
      label: 'Expired',
      count: allPriceLists.filter((p) => p.status === 'expired').length,
    },
  ]

  const isEmptyOverall = !isLoading && allPriceLists.length === 0
  const isFilteredEmpty = !isLoading && allPriceLists.length > 0 && priceLists.length === 0

  return (
    <div className={`w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8 ${PLEX}`}>
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#17171c] md:text-3xl">Price Lists</h1>
            <p className="mt-1 text-sm text-[#5b5b6b]">
              One selling price per item, per price use type, per branch. Priority settles the
              overlaps.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCategoriesDrawerOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-[#e4e4e9] bg-white px-3 py-2 text-sm font-medium text-[#3d3d4a] hover:border-[#d3d3db] hover:bg-[#fbfbfc]"
            >
              <Tags className="h-4 w-4" />
              <span className="hidden sm:inline">Price use types</span>
            </button>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 rounded-lg border border-[#e4e4e9] bg-white px-3 py-2 text-sm font-medium text-[#3d3d4a] hover:border-[#d3d3db] hover:bg-[#fbfbfc] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {canCreate && (
              <button
                type="button"
                onClick={openCreateModal}
                className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-3 py-2 text-sm font-medium text-white hover:bg-[#4a189b] sm:px-4"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New price list</span>
              </button>
            )}
          </div>
        </div>

        {/* Coverage band */}
        <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-[#e4e4e9] bg-white lg:grid-cols-4">
          {coverageTiles.map((tile, index) => {
            const isOn = filters.status === tile.status
            return (
              <button
                key={tile.key}
                type="button"
                onClick={() => setFilters({ status: isOn ? 'all' : tile.status })}
                aria-pressed={isOn}
                className={`flex flex-col gap-1 px-4 py-3 text-left transition-colors ${
                  index % 2 === 1 ? 'border-l border-[#eeeef1]' : ''
                } lg:border-l lg:first:border-l-0 ${index > 1 ? 'border-t border-[#eeeef1] lg:border-t-0' : ''} ${
                  isOn ? 'bg-[#f1ebfb] shadow-[inset_0_-2px_0_#5b21b6]' : 'hover:bg-[#fbfbfc]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tile.dot}`} />
                  <span
                    className={`${MONO} text-[10px] font-semibold uppercase tracking-[0.09em] text-[#5b5b6b]`}
                  >
                    {tile.label}
                  </span>
                </span>
                <span
                  className={`${MONO} text-[20px] font-semibold tracking-tight ${tile.value === 0 ? 'text-[#a3a3b2]' : 'text-[#17171c]'}`}
                >
                  {isLoading ? '—' : tile.value}
                </span>
                <span className="text-[11px] text-[#5b5b6b]">{tile.note}</span>
              </button>
            )
          })}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b8b9b]" />
            <input
              type="text"
              value={filters.query}
              onChange={(e) => setFilters({ query: e.target.value })}
              placeholder="Search name, description, or use type…"
              className="w-full rounded-lg border border-[#e4e4e9] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#5b21b6] focus:ring-1 focus:ring-[#5b21b6]"
            />
          </div>
          <div className="w-48">
            <Select
              value={filters.priceUseTypeId}
              onChange={(value) => setFilters({ priceUseTypeId: value })}
              options={[
                { value: 'all', label: 'All use types' },
                ...priceUseTypes.map((t) => ({ value: t.id, label: t.name })),
              ]}
              compact
            />
          </div>
          <div className="w-48">
            <Select
              value={filters.sort}
              onChange={(value) => setFilters({ sort: value as PriceListSort })}
              options={SORT_OPTIONS}
              compact
            />
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[#3f1490] hover:bg-[#f1ebfb]"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap items-center gap-2">
          {statusPills.map((pill) => {
            const isOn = filters.status === pill.value
            return (
              <button
                key={pill.value}
                type="button"
                onClick={() => setFilters({ status: pill.value })}
                aria-pressed={isOn}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isOn
                    ? 'border-[#5b21b6] bg-[#5b21b6] text-white'
                    : 'border-[#e4e4e9] bg-white text-[#3d3d4a] hover:border-[#d3d3db]'
                }`}
              >
                {pill.label}
                <span
                  className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${isOn ? 'bg-white/20' : 'bg-[#f1f1f4] text-[#5b5b6b]'}`}
                >
                  {pill.count}
                </span>
              </button>
            )
          })}
        </div>

        {error && (
          <div className="rounded-lg border border-[#f3c9c5] bg-[#fdeceb] p-4">
            <p className="text-sm font-medium text-[#8f1c14]">Failed to load price lists</p>
          </div>
        )}

        {/* Table */}
        <div
          className={`overflow-hidden rounded-xl border border-[#e4e4e9] bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
        >
          {isLoading ? (
            <div className="p-8 text-center text-sm text-[#8b8b9b]">Loading price lists…</div>
          ) : isEmptyOverall ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <Tag className="mb-3 h-10 w-10 text-[#c9c9d3]" />
              <p className="text-sm font-medium text-[#3d3d4a]">No price lists yet</p>
              <p className="mt-1 max-w-md text-xs text-[#5b5b6b]">
                A price list holds the selling price for each item under one price use type — cash,
                credit card, zero interest. Create the first one, then price items into it.
              </p>
              {canCreate && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-4 flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a189b]"
                >
                  <Plus className="h-4 w-4" />
                  New price list
                </button>
              )}
            </div>
          ) : isFilteredEmpty ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <Search className="mb-3 h-8 w-8 text-[#c9c9d3]" />
              <p className="text-sm font-medium text-[#3d3d4a]">No price lists match</p>
              <p className="mt-1 max-w-md text-xs text-[#5b5b6b]">
                {filters.query
                  ? `Nothing matches “${filters.query}” inside the current filters.`
                  : 'No price list falls inside these filters.'}
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 rounded-lg border border-[#e4e4e9] px-4 py-2 text-sm font-medium text-[#3d3d4a] hover:border-[#d3d3db] hover:bg-[#fbfbfc]"
              >
                Clear search and filters
              </button>
            </div>
          ) : (
            <>
              {/* Mobile: card list */}
              <ul className="divide-y divide-[#eeeef1] md:hidden">
                {priceLists.map((pl) => {
                  const scope = branchScopeShort(pl.allowedBranchIds, branches.length)
                  const cover = coverage(pl.itemCount, catalogTotal)
                  return (
                    <li key={pl.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/inventory/price-lists/${pl.id}`}
                            className="truncate font-medium text-[#17171c] hover:text-[#3f1490] hover:underline"
                          >
                            {pl.name}
                          </Link>
                          {pl.description && (
                            <p className="truncate text-xs text-[#8b8b9b]">{pl.description}</p>
                          )}
                        </div>
                        <StatusChip status={pl.status} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {pl.priceUseType && (
                          <span className="inline-flex rounded-md bg-[#f0e9fc] px-2 py-0.5 text-[11px] font-medium text-[#3f1490]">
                            {pl.priceUseType.name}
                          </span>
                        )}
                        <span className="text-[11px] text-[#8b8b9b]">
                          {pl.currency} · Priority {pl.priority}
                        </span>
                        {/* Scenario 50 Gap 7 — every list now stores a real
                            mode (the 2026-09-14 backfill made the column NOT
                            NULL DEFAULT 'inclusive'), so this no longer papers
                            over undeclared rows. The non-exclusive branch stays
                            the default for resilience only. */}
                        <span className="inline-flex rounded-md bg-[#f1f1f4] px-2 py-0.5 text-[11px] font-medium text-[#5b5b6b]">
                          VAT {pl.pricingMode === 'exclusive' ? 'Exclusive' : 'Inclusive'}
                        </span>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <dt className="text-[11px] text-[#8b8b9b]">Items priced</dt>
                          <dd className="font-semibold text-[#17171c]">
                            {(pl.itemCount ?? 0).toLocaleString()}
                          </dd>
                          <dd className="text-[11px] text-[#8b8b9b]">
                            {itemCountLabel(pl.itemCount)} — {cover.note}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-[#8b8b9b]">Applies to</dt>
                          <dd className="text-[#3d3d4a]">{scope.label}</dd>
                          <dd className="text-[11px] text-[#8b8b9b]">
                            {effectiveSummary(pl.effectiveFrom, pl.effectiveTo).label}
                          </dd>
                        </div>
                      </dl>
                      {(canUpdate || canApprove || canDelete) && (
                        <div className="mt-3 border-t border-[#eeeef1] pt-3">
                          <PriceListActions
                            pl={pl}
                            canUpdate={canUpdate}
                            canApprove={canApprove}
                            canDelete={canDelete}
                            isResubmitting={isResubmitting}
                            justify="start"
                            onEdit={() => openEditModal(pl)}
                            onApprove={() => setApprovingList(pl)}
                            onReject={() => setRejectingList(pl)}
                            onResubmit={() => resubmitPriceList(pl.id)}
                            onDelete={() => setDeletingList(pl)}
                          />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[64rem] table-fixed text-sm">
                  <thead>
                    <tr
                      className={`border-b border-[#eeeef1] bg-[#fbfbfc] text-left ${MONO} text-[10px] font-semibold uppercase tracking-[0.09em] text-[#5b5b6b]`}
                    >
                      <th className="w-[23%] px-4 py-3">Price list</th>
                      <th className="w-[16%] px-4 py-3">Use type</th>
                      <th className="w-[12%] px-4 py-3 text-right">Items priced</th>
                      <th className="w-[15%] px-4 py-3">Applies to</th>
                      <th className="w-[15%] px-4 py-3">Effective</th>
                      <th className="w-[10%] px-4 py-3">Status</th>
                      {(canUpdate || canApprove || canDelete) && (
                        <th className="w-[9%] px-4 py-3 text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eeeef1]">
                    {priceLists.map((pl) => {
                      const scope = branchScopeShort(pl.allowedBranchIds, branches.length)
                      const eff = effectiveSummary(pl.effectiveFrom, pl.effectiveTo)
                      const cover = coverage(pl.itemCount, catalogTotal)
                      const isThin =
                        cover.percent !== null && cover.percent < THIN_COVERAGE_THRESHOLD
                      return (
                        <tr key={pl.id} className="align-top hover:bg-[#fbfbfc]">
                          <td className="px-4 py-3">
                            <Link
                              href={`/inventory/price-lists/${pl.id}`}
                              className="block truncate font-medium text-[#17171c] hover:text-[#3f1490] hover:underline"
                            >
                              {pl.name}
                            </Link>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] text-[#8b8b9b]">{pl.currency}</span>
                              <span className="inline-flex rounded-md bg-[#f1f1f4] px-2 py-0.5 text-[11px] font-medium text-[#5b5b6b]">
                                VAT {pl.pricingMode === 'exclusive' ? 'Exclusive' : 'Inclusive'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {pl.priceUseType ? (
                              <span
                                className={`inline-flex rounded bg-[#f1ebfb] px-2 py-0.5 ${MONO} text-[10.5px] font-semibold text-[#3f1490]`}
                              >
                                {pl.priceUseType.name}
                              </span>
                            ) : (
                              <span className="text-xs text-[#8b8b9b]">—</span>
                            )}
                            <p className="mt-1 text-[11px] text-[#8b8b9b]">
                              Priority {pl.priority}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {/* The number carries the column; the tooltip
                                spells the whole reading out, including how
                                much of the catalog is left unpriced. */}
                            <Tooltip
                              label={`${itemCountLabel(pl.itemCount)} — ${cover.note}`}
                              side="top"
                              align="end"
                            >
                              <span
                                className={`${MONO} text-[13.5px] font-semibold text-[#17171c]`}
                              >
                                {(pl.itemCount ?? 0).toLocaleString()}
                              </span>
                            </Tooltip>
                            <p
                              className={`text-[11px] ${isThin ? 'text-[#d18b1d]' : 'text-[#8b8b9b]'}`}
                            >
                              {cover.note}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            {/* The cell shows the count; the names live in the
                                tooltip. A branch-scoped list can carry twenty
                                of them, which no column width survives. */}
                            <Tooltip
                              label={branchScopeTooltip(pl.allowedBranchIds, branches)}
                              side="top"
                              align="start"
                              className="max-w-full"
                            >
                              <span className="truncate text-[#3d3d4a]">{scope.label}</span>
                            </Tooltip>
                            <p className="text-[11px] text-[#8b8b9b]">{scope.note}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="truncate text-[#3d3d4a]">{eff.label}</p>
                            <p className="text-[11px] text-[#8b8b9b]">{eff.note}</p>
                          </td>
                          <td className="px-4 py-3">
                            <StatusChip status={pl.status} />
                          </td>
                          {(canUpdate || canApprove || canDelete) && (
                            <td className="px-4 py-3 text-right">
                              <PriceListActions
                                pl={pl}
                                canUpdate={canUpdate}
                                canApprove={canApprove}
                                canDelete={canDelete}
                                isResubmitting={isResubmitting}
                                onEdit={() => openEditModal(pl)}
                                onApprove={() => setApprovingList(pl)}
                                onReject={() => setRejectingList(pl)}
                                onResubmit={() => resubmitPriceList(pl.id)}
                                onDelete={() => setDeletingList(pl)}
                              />
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {priceLists.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eeeef1] px-4 py-3 text-sm text-[#5b5b6b]">
              <span className="text-xs">
                Showing {priceLists.length} of {pagination.total} price list
                {pagination.total === 1 ? '' : 's'}
              </span>
              {pagination.totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <span className="mr-2 text-xs">
                    Page {page} of {pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="rounded-lg px-3 py-1.5 hover:bg-[#f1f1f4] disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                    disabled={page >= pagination.totalPages}
                    className="rounded-lg px-3 py-1.5 hover:bg-[#f1f1f4] disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <PriceListModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        isSubmitting={editingList ? isUpdating : isCreating}
        branches={branches}
        priceUseTypes={priceUseTypes}
        priceLists={allPriceLists}
        catalogTotal={catalogTotal}
        onCreatePriceUseType={createPriceUseType}
        isCreatingPriceUseType={isCreatingPriceUseType}
        initial={editingList}
      />

      <ApprovePriceListModal
        open={approvingList !== null}
        onClose={() => setApprovingList(null)}
        priceList={approvingList}
        onApprove={handleApprove}
        isApproving={isApproving}
      />

      <RejectPriceListModal
        open={rejectingList !== null}
        onClose={() => setRejectingList(null)}
        priceList={rejectingList}
        onReject={handleReject}
        isRejecting={isRejecting}
      />

      <DeletePriceListModal
        open={deletingList !== null}
        onClose={() => setDeletingList(null)}
        priceList={deletingList}
        onDelete={handleDelete}
        isDeleting={isDeleting}
      />

      <ManageCategoriesDrawer
        isOpen={isCategoriesDrawerOpen}
        onClose={() => setIsCategoriesDrawerOpen(false)}
        session={session}
        priceLists={allPriceLists}
      />
    </div>
  )
}
