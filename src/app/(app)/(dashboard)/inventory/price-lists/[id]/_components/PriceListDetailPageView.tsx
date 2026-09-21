'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, Loader2, Search, XCircle } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { ApprovePriceListModal } from '../../_components/ApprovePriceListModal'
import { RejectPriceListModal } from '../../_components/RejectPriceListModal'
import {
  EDITABLE_STATUSES,
  STATUS_LABELS,
  statusTone,
  branchScopeLabel,
  effectiveSummary,
} from '../../_lib/price-list-format'
import { usePriceListDetail } from '../_hooks/usePriceListDetail'
import { usePriceListItemsPage } from '../_hooks/usePriceListItemsPage'
import { PriceListItemsTable } from './PriceListItemsTable'
import { AddItemsPanel } from './AddItemsPanel'
import type {
  ApprovePriceListFormValues,
  PriceListItem,
  RejectPriceListFormValues,
} from '@/src/schema/inventory/price-lists'
import { PLEX, MONO } from '@/src/libs/design/plex'

function isBlank(value: string | number | null | undefined) {
  return value == null || String(value).trim() === ''
}

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
  // One search surface, switched by intent. Filtering this list and
  // searching the whole catalog are different questions, and two boxes
  // asking them side by side just read as the same box twice.
  const [mode, setMode] = useState<'filter' | 'add'>('filter')

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
    saveItems,
    isSaving,
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
      <div className="flex min-h-full items-center justify-center py-24 text-[#8b8b9b]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (error || !priceList) {
    return (
      <div className={`w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8 ${PLEX}`}>
        <div className="mx-auto max-w-3xl">
          <Link
            href="/inventory/price-lists"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#5b5b6b] hover:text-[#3f1490]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Price Lists
          </Link>
          <div className="rounded-lg border border-[#f3c9c5] bg-[#fdeceb] p-4">
            <p className="text-sm font-medium text-[#8f1c14]">Price list could not be found.</p>
          </div>
        </div>
      </div>
    )
  }

  const canEdit = Boolean(canUpdate && EDITABLE_STATUSES.includes(priceList.status))
  const tone = statusTone(priceList.status)
  const eff = effectiveSummary(priceList.effectiveFrom, priceList.effectiveTo)

  // Everything counted per-field is scoped to the loaded page on purpose —
  // only this page's rows are in memory, and quoting a whole-list figure the
  // server never sent would be a guess. The labels say so.
  const missingDownPayment = items.filter((i: PriceListItem) => isBlank(i.downPayment)).length

  const stats = [
    {
      label: 'Items priced',
      value: total.toLocaleString(),
      note: 'across the whole list',
      tone: total === 0 ? 'text-[#c9c9d3]' : 'text-[#17171c]',
    },
    {
      label: 'No down payment',
      value: missingDownPayment.toLocaleString(),
      note: missingDownPayment ? 'on this page — installments fall back' : 'none on this page',
      tone: missingDownPayment ? 'text-[#d18b1d]' : 'text-[#17171c]',
    },
    {
      label: 'Priority',
      value: String(priceList.priority),
      note: 'higher wins a clash',
      tone: 'text-[#17171c]',
    },
  ]

  return (
    <div className={`w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8 ${PLEX}`}>
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <Link
            href="/inventory/price-lists"
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#5b5b6b] hover:text-[#3f1490]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Price Lists
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-[#17171c] md:text-3xl">{priceList.name}</h1>
                {priceList.priceUseType && (
                  <span className="inline-flex rounded-md bg-[#f0e9fc] px-2.5 py-1 text-xs font-medium text-[#3f1490]">
                    {priceList.priceUseType.name}
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium ${tone.chip}`}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
                  {STATUS_LABELS[priceList.status] ?? priceList.status}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-[#5b5b6b]">
                {eff.label} ({eff.note}) · {branchScopeLabel(priceList.allowedBranchIds, branches)}{' '}
                · {priceList.currency} ·{' '}
                {priceList.pricingMode === 'exclusive' ? 'VAT exclusive' : 'VAT inclusive'}
              </p>
              {priceList.description && (
                <p className="mt-1 text-sm text-[#8b8b9b]">{priceList.description}</p>
              )}
            </div>

            {priceList.status === 'pending_approval' && canApprove && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#f3c9c5] px-3 py-2 text-sm font-medium text-[#b42318] hover:bg-[#fdeceb]"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => setIsApproveModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#0f7b52] px-3 py-2 text-sm font-medium text-white hover:bg-[#0b6644]"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Coverage band */}
        <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-[#e4e4e9] bg-white lg:grid-cols-4">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className={`flex flex-col gap-1 px-4 py-3 ${index % 2 === 1 ? 'border-l border-[#eeeef1]' : ''} lg:border-l lg:first:border-l-0 ${index > 1 ? 'border-t border-[#eeeef1] lg:border-t-0' : ''}`}
            >
              <span
                className={`${MONO} text-[10px] font-semibold uppercase tracking-[0.09em] text-[#5b5b6b]`}
              >
                {stat.label}
              </span>
              <span className={`${MONO} text-[19px] font-semibold tracking-tight ${stat.tone}`}>
                {stat.value}
              </span>
              <span className="text-[11px] text-[#5b5b6b]">{stat.note}</span>
            </div>
          ))}
        </div>

        {!canEdit && (
          <div className="rounded-lg border border-[#f5e2c6] bg-[#fdf3e7] px-4 py-2 text-xs text-[#8a4b06]">
            This list is {priceList.status.replace('_', ' ')} — items are read-only. Create a new
            version to make changes.
          </div>
        )}
        {canEdit && priceList.status === 'active' && (
          <div className="rounded-lg border border-[#c5d6f0] bg-[#eaf0fb] px-4 py-2 text-xs text-[#1f4b99]">
            This list is currently active. Adding, editing, or removing an item here moves the whole
            list back to Pending Approval — it stops applying at checkout entirely (not just this
            item) until someone re-approves it.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {canEdit && (
            <div className="inline-flex gap-1 rounded-lg border border-[#e4e4e9] bg-white p-1">
              {(
                [
                  { value: 'filter', label: 'Filter this list' },
                  { value: 'add', label: 'Add items' },
                ] as const
              ).map((option) => {
                const isOn = mode === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isOn}
                    onClick={() => {
                      // Leaving filter mode hides the input, so a filter left
                      // behind would quietly shrink the table with nothing on
                      // screen explaining why.
                      if (option.value === 'add' && search) setSearch('')
                      setMode(option.value)
                    }}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      isOn ? 'bg-[#5b21b6] text-white' : 'text-[#5b5b6b] hover:text-[#17171c]'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          )}

          {mode === 'filter' && (
            <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b8b9b]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items by name or SKU…"
                className="w-full rounded-lg border border-[#e4e4e9] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#5b21b6] focus:ring-1 focus:ring-[#5b21b6]"
              />
            </div>
          )}

          <span className="text-xs text-[#5b5b6b]">
            {mode === 'filter'
              ? `Searches the ${total.toLocaleString()} item${total === 1 ? '' : 's'} already priced here.`
              : 'Searches the whole catalog. Adding an item sends the list back for approval.'}
          </span>
        </div>

        {canEdit && mode === 'add' && (
          <div className="rounded-xl border border-[#ddd0f7] bg-[#f1ebfb]">
            <AddItemsPanel onAdd={addItems} isAdding={isAdding} />
          </div>
        )}

        <PriceListItemsTable
          items={items}
          total={total}
          page={page}
          setPage={setPage}
          totalPages={totalPages}
          search={search}
          isLoading={isItemsLoading}
          isFetching={isItemsFetching}
          canEdit={canEdit}
          onRemoveOne={(itemId) => removeItem(itemId)}
          onRemoveMany={(itemIds) => removeItems(itemIds)}
          isRemovingMany={isRemovingMany}
          onSave={saveItems}
          isSaving={isSaving}
          savingRevertsToPending={priceList.status === 'active'}
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
