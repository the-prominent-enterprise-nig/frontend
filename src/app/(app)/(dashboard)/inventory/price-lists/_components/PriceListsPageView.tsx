'use client'

import { useState } from 'react'
import {
  Plus,
  RefreshCw,
  Tag,
  Pencil,
  CheckCircle,
  XCircle,
  RotateCcw,
  Copy,
  ListChecks,
} from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { usePriceLists } from '../_hooks/usePriceLists'
import PriceListModal from './PriceListModal'
import { ApprovePriceListModal } from './ApprovePriceListModal'
import { RejectPriceListModal } from './RejectPriceListModal'
import { PriceListItemsModal } from './PriceListItemsModal'
import type {
  ApprovePriceListFormValues,
  PriceList,
  PriceListFormValues,
  RejectPriceListFormValues,
} from '@/src/schema/inventory/price-lists'
import type { Branch } from '../_actions/get-branches'

const EDITABLE_STATUSES = ['pending_approval', 'rejected']
const SUPERSEDABLE_STATUSES = ['active', 'inactive', 'expired']

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending_approval: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  inactive: 'bg-zinc-100 text-zinc-500',
  expired: 'bg-zinc-100 text-zinc-500',
}

const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Pending',
  active: 'Active',
  rejected: 'Rejected',
  inactive: 'Inactive',
  expired: 'Expired',
}

function statusBadge(status: string) {
  return STATUS_BADGE_CLASS[status] ?? 'bg-zinc-100 text-zinc-500'
}

function listTypeBadge(type: string) {
  const map: Record<string, string> = {
    retail: 'bg-blue-100 text-blue-700',
    wholesale: 'bg-teal-100 text-teal-700',
    member: 'bg-violet-100 text-violet-700',
    promotional: 'bg-pink-100 text-pink-700',
    custom: 'bg-amber-100 text-amber-700',
  }
  return map[type] ?? 'bg-zinc-100 text-zinc-500'
}

function branchScopeLabel(allowedBranchIds: string[] | undefined, branches: Branch[]) {
  if (!allowedBranchIds || allowedBranchIds.length === 0) return 'All branches'
  const names = branches.filter((b) => allowedBranchIds.includes(b.id)).map((b) => b.name)
  if (names.length === 0) return `${allowedBranchIds.length} branch(es)`
  return names.join(', ')
}

function formatDate(date?: string | null) {
  if (!date) return '—'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString()
}

function formatEffectiveRange(from?: string | null, to?: string | null) {
  if (!from && !to) return 'No date range'
  return `${formatDate(from)} – ${formatDate(to)}`
}

export default function PriceListsPageView({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.PRICE_LISTS_CREATE)
  const canUpdate = hasPermission(session, INVENTORY_PERMISSIONS.PRICE_LISTS_UPDATE)
  const canApprove = hasPermission(session, INVENTORY_PERMISSIONS.PRICE_LISTS_APPROVE)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingList, setEditingList] = useState<PriceList | undefined>(undefined)
  const [versioningFrom, setVersioningFrom] = useState<PriceList | undefined>(undefined)
  const [approvingList, setApprovingList] = useState<PriceList | null>(null)
  const [rejectingList, setRejectingList] = useState<PriceList | null>(null)
  const [managingItemsList, setManagingItemsList] = useState<PriceList | null>(null)

  const {
    priceLists,
    pagination,
    isLoading,
    isFetching,
    error,
    page,
    setPage,
    currencies,
    branches,
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
    refetch,
  } = usePriceLists()

  function openCreateModal() {
    setEditingList(undefined)
    setVersioningFrom(undefined)
    setIsModalOpen(true)
  }

  function openEditModal(list: PriceList) {
    setEditingList(list)
    setVersioningFrom(undefined)
    setIsModalOpen(true)
  }

  function openNewVersionModal(list: PriceList) {
    setEditingList(undefined)
    setVersioningFrom(list)
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
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
              >
                <Plus className="h-4 w-4" />
                New Price List
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
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="w-[40%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Price List
                  </th>
                  <th className="w-[14%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Status
                  </th>
                  <th className="w-[20%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                    Effective
                  </th>
                  <th className="w-[16%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                    Branches
                  </th>
                  {(canUpdate || canApprove) && (
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
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${listTypeBadge(pl.listType)}`}
                        >
                          {pl.listType}
                        </span>
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
                    </td>
                    <td className="hidden px-4 py-3 text-zinc-600 sm:table-cell">
                      {formatEffectiveRange(pl.effectiveFrom, pl.effectiveTo)}
                    </td>
                    <td className="hidden truncate px-4 py-3 text-zinc-600 md:table-cell">
                      {branchScopeLabel(pl.allowedBranchIds, branches)}
                    </td>
                    {(canUpdate || canApprove) && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Manage Items"
                            onClick={() => setManagingItemsList(pl)}
                            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
                          >
                            <ListChecks className="h-4 w-4" />
                          </button>
                          {canUpdate && EDITABLE_STATUSES.includes(pl.status) && (
                            <button
                              type="button"
                              title="Edit"
                              onClick={() => openEditModal(pl)}
                              className="rounded-lg p-1.5 text-prominent-purple-700 hover:bg-prominent-purple-50"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canCreate && SUPERSEDABLE_STATUSES.includes(pl.status) && (
                            <button
                              type="button"
                              title="New Version"
                              onClick={() => openNewVersionModal(pl)}
                              className="rounded-lg p-1.5 text-prominent-purple-700 hover:bg-prominent-purple-50"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          )}
                          {pl.status === 'pending_approval' && canApprove && (
                            <>
                              <button
                                type="button"
                                title="Approve"
                                onClick={() => setApprovingList(pl)}
                                className="rounded-lg p-1.5 text-green-700 hover:bg-green-50"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title="Reject"
                                onClick={() => setRejectingList(pl)}
                                className="rounded-lg p-1.5 text-red-700 hover:bg-red-50"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {pl.status === 'rejected' && canUpdate && (
                            <button
                              type="button"
                              title="Resubmit"
                              onClick={() => resubmitPriceList(pl.id)}
                              disabled={isResubmitting}
                              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
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
        initial={editingList}
        supersedesFrom={versioningFrom}
      />

      <PriceListItemsModal
        open={managingItemsList !== null}
        onClose={() => setManagingItemsList(null)}
        priceList={managingItemsList}
        canEdit={Boolean(
          canUpdate && managingItemsList && EDITABLE_STATUSES.includes(managingItemsList.status)
        )}
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
    </div>
  )
}
