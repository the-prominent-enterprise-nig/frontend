'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, Loader2, XCircle } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { ApprovePriceListModal } from '../../_components/ApprovePriceListModal'
import { RejectPriceListModal } from '../../_components/RejectPriceListModal'
import {
  EDITABLE_STATUSES,
  STATUS_LABELS,
  statusBadge,
  branchScopeLabel,
  formatEffectiveRange,
} from '../../_lib/price-list-format'
import { usePriceListDetail } from '../_hooks/usePriceListDetail'
import { usePriceListItemsPage } from '../_hooks/usePriceListItemsPage'
import { PriceListItemsTable } from './PriceListItemsTable'
import { AddItemsPanel } from './AddItemsPanel'
import type {
  ApprovePriceListFormValues,
  RejectPriceListFormValues,
} from '@/src/schema/inventory/price-lists'

export function PriceListDetailPageView({
  priceListId,
  session,
}: {
  priceListId: string
  session: SessionUser
}) {
  const canUpdate = hasPermission(session, INVENTORY_PERMISSIONS.PRICE_LISTS_UPDATE)
  const canApprove = hasPermission(session, INVENTORY_PERMISSIONS.PRICE_LISTS_APPROVE)
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)

  const {
    priceList,
    isLoading,
    error,
    branches,
    approvePriceList,
    isApproving,
    rejectPriceList,
    isRejecting,
  } = usePriceListDetail(priceListId)

  const {
    items,
    total,
    page,
    setPage,
    totalPages,
    search,
    setSearch,
    isLoading: isItemsLoading,
    isFetching: isItemsFetching,
    addItems,
    isAdding,
    removeItem,
    removeItems,
    isRemovingMany,
  } = usePriceListItemsPage(priceListId, priceList?.status)

  async function handleApprove(id: string, data: ApprovePriceListFormValues) {
    await approvePriceList(data)
  }

  async function handleReject(id: string, data: RejectPriceListFormValues) {
    await rejectPriceList(data)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center py-24 text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (error || !priceList) {
    return (
      <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/inventory/price-lists"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-prominent-purple-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Price Lists
          </Link>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Price list could not be found.</p>
          </div>
        </div>
      </div>
    )
  }

  const canEdit = Boolean(canUpdate && EDITABLE_STATUSES.includes(priceList.status))

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link
            href="/inventory/price-lists"
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-prominent-purple-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Price Lists
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">{priceList.name}</h1>
                {priceList.priceUseType && (
                  <span className="inline-flex rounded-full bg-prominent-purple-100 px-2.5 py-0.5 text-xs font-medium text-prominent-purple-700">
                    {priceList.priceUseType.name}
                  </span>
                )}
                <span
                  className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(priceList.status)}`}
                >
                  {STATUS_LABELS[priceList.status] ?? priceList.status}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
                <span>{formatEffectiveRange(priceList.effectiveFrom, priceList.effectiveTo)}</span>
                <span aria-hidden>·</span>
                <span>{branchScopeLabel(priceList.allowedBranchIds, branches)}</span>
              </div>
            </div>

            {priceList.status === 'pending_approval' && canApprove && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => setIsApproveModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </button>
              </div>
            )}
          </div>
        </div>

        {!canEdit && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            This list is {priceList.status.replace('_', ' ')} — items are read-only. Create a new
            version to make changes.
          </div>
        )}
        {canEdit && priceList.status === 'active' && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-800">
            This list is currently active. Adding or removing an item here moves the whole list back
            to Pending Approval — it stops applying at checkout entirely (not just this item) until
            someone re-approves it.
          </div>
        )}

        {canEdit && <AddItemsPanel onAdd={addItems} isAdding={isAdding} />}

        <PriceListItemsTable
          items={items}
          total={total}
          page={page}
          setPage={setPage}
          totalPages={totalPages}
          search={search}
          setSearch={setSearch}
          isLoading={isItemsLoading}
          isFetching={isItemsFetching}
          canEdit={canEdit}
          onRemoveOne={(itemId) => removeItem(itemId)}
          onRemoveMany={(itemIds) => removeItems(itemIds)}
          isRemovingMany={isRemovingMany}
        />
      </div>

      <ApprovePriceListModal
        open={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        priceList={priceList}
        onApprove={handleApprove}
        isApproving={isApproving}
      />

      <RejectPriceListModal
        open={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        priceList={priceList}
        onReject={handleReject}
        isRejecting={isRejecting}
      />
    </div>
  )
}
