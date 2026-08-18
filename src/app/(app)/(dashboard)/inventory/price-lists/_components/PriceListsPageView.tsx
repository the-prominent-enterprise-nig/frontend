'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Plus,
  RefreshCw,
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
import { usePriceLists } from '../_hooks/usePriceLists'
import PriceListModal from './PriceListModal'
import { ApprovePriceListModal } from './ApprovePriceListModal'
import { RejectPriceListModal } from './RejectPriceListModal'
import { DeletePriceListModal } from './DeletePriceListModal'
import ManageCategoriesDrawer from './ManageCategoriesDrawer'
import {
  EDITABLE_STATUSES,
  DELETABLE_STATUSES,
  STATUS_LABELS,
  statusBadge,
  itemCountLabel,
  branchScopeLabel,
  formatEffectiveRange,
} from '../_lib/price-list-format'
import type {
  ApprovePriceListFormValues,
  PriceList,
  PriceListFormValues,
  RejectPriceListFormValues,
} from '@/src/schema/inventory/price-lists'

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
      className={`flex flex-wrap items-center gap-1 ${justify === 'end' ? 'justify-end' : 'justify-start'}`}
    >
      <Link
        href={`/inventory/price-lists/${pl.id}`}
        title="Manage Items"
        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
      >
        <ListChecks className="h-4 w-4" />
      </Link>
      {pl.status === 'pending_approval' && canApprove && (
        <>
          <button
            type="button"
            title="Approve"
            onClick={onApprove}
            className="rounded-lg p-1.5 text-green-700 hover:bg-green-50"
          >
            <CheckCircle className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Reject"
            onClick={onReject}
            className="rounded-lg p-1.5 text-red-700 hover:bg-red-50"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </>
      )}
      <RowActionsMenu items={menuItems} />
    </div>
  )
}

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
    pagination,
    isLoading,
    isFetching,
    error,
    page,
    setPage,
    showInactive,
    setShowInactive,
    currencies,
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

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Price Lists</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Manage pricing tiers for your inventory items.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm text-zinc-500">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-prominent-purple-700 focus:ring-prominent-purple-600"
              />
              <span className="hidden sm:inline">Show inactive/expired</span>
            </label>
            <button
              type="button"
              onClick={() => setIsCategoriesDrawerOpen(true)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
            >
              <Tags className="h-4 w-4" />
              <span className="hidden sm:inline">Price Use Types</span>
            </button>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-prominent-purple-700 hover:bg-prominent-purple-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {canCreate && (
              <button
                type="button"
                onClick={openCreateModal}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-3 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 sm:px-4"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Price List</span>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load price lists</p>
          </div>
        )}

        {/* Table */}
        <div
          className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
        >
          {isLoading ? (
            <div className="p-8 text-center text-sm text-zinc-400">Loading price lists…</div>
          ) : priceLists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Tag className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No price lists yet</p>
              {canCreate && (
                <p className="mt-1 text-xs text-zinc-400">
                  Create a price list to define pricing tiers for your items.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Mobile: card list */}
              <ul className="divide-y divide-zinc-100 md:hidden">
                {priceLists.map((pl) => (
                  <li key={pl.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-900">{pl.name}</p>
                        {pl.description && (
                          <p className="truncate text-xs text-zinc-400">{pl.description}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-0.5">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(pl.status)}`}
                        >
                          {STATUS_LABELS[pl.status] ?? pl.status}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {itemCountLabel(pl.itemCount)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {pl.priceUseType && (
                        <span className="inline-flex rounded-full bg-prominent-purple-100 px-2 py-0.5 text-[11px] font-medium text-prominent-purple-700">
                          {pl.priceUseType.name}
                        </span>
                      )}
                      <span className="text-[11px] text-zinc-400">
                        {pl.currency} · Priority {pl.priority}
                      </span>
                    </div>
                    <div className="mt-2 space-y-0.5 text-xs text-zinc-500">
                      <p>{formatEffectiveRange(pl.effectiveFrom, pl.effectiveTo)}</p>
                      <p className="truncate">{branchScopeLabel(pl.allowedBranchIds, branches)}</p>
                    </div>
                    {(canUpdate || canApprove || canDelete) && (
                      <div className="mt-3 border-t border-zinc-100 pt-3">
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
                ))}
              </ul>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-180 table-fixed text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className="w-[40%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Price List
                      </th>
                      <th className="w-[14%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Status
                      </th>
                      <th className="w-[20%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Effective
                      </th>
                      <th className="w-[16%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Branches
                      </th>
                      {(canUpdate || canApprove || canDelete) && (
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {priceLists.map((pl) => (
                      <tr key={pl.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <p className="truncate font-medium text-zinc-900">{pl.name}</p>
                          {pl.description && (
                            <p className="truncate text-xs text-zinc-400">{pl.description}</p>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {pl.priceUseType && (
                              <span className="inline-flex rounded-full bg-prominent-purple-100 px-2 py-0.5 text-[11px] font-medium text-prominent-purple-700">
                                {pl.priceUseType.name}
                              </span>
                            )}
                            <span className="text-[11px] text-zinc-400">
                              {pl.currency} · Priority {pl.priority}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(pl.status)}`}
                          >
                            {STATUS_LABELS[pl.status] ?? pl.status}
                          </span>
                          <p className="mt-1 text-[11px] text-zinc-400">
                            {itemCountLabel(pl.itemCount)}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {formatEffectiveRange(pl.effectiveFrom, pl.effectiveTo)}
                        </td>
                        <td className="truncate px-4 py-3 text-zinc-600">
                          {branchScopeLabel(pl.allowedBranchIds, branches)}
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
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-sm text-zinc-500">
              <span>
                Page {page} of {pagination.totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                  disabled={page >= pagination.totalPages}
                  className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <PriceListModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        isSubmitting={editingList ? isUpdating : isCreating}
        currencies={currencies}
        branches={branches}
        priceUseTypes={priceUseTypes}
        priceLists={priceLists}
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
      />
    </div>
  )
}
