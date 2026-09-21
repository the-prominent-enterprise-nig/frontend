'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Plus, Loader2, Send, Search, X } from 'lucide-react'
import { usePurchaseRequests } from '../_hooks/usePurchaseRequests'
import { usePurchaseOrders } from '../../purchase-orders/_hooks/usePurchaseOrders'
import { CreatePoModal } from '../../purchase-orders/_components/CreatePoModal'
import { ConvertPrToPoModal } from './ConvertPrToPoModal'
import { ViewPurchaseRequestModal } from './ViewPurchaseRequestModal'
import { getPurchaseRequest } from '../_actions/get-purchase-request'
import { ConfirmActionModal } from '@/src/components/inventory/ConfirmActionModal'
import Tooltip from '@/src/components/ui/Tooltip'
import { hasPermission } from '@/src/hooks/usePermission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { PurchaseRequestSummary } from '@/src/schema/inventory/purchase-requests'
import { PLEX, MONO } from '../../purchase-orders/_components/procurementTokens'

// ─── Design tokens ────────────────────────────────────────────────────────────
// Same #5b21b6 palette as procurementTokens/PurchaseOrderList —
// this is the other tab in the same hub, so it has to read as one screen
// rather than an older design a reader happens to land on partway through.

// 'Submitted' has no tab of its own — a submitted PR either auto-converts
// in the same request (no separate approval step) or needs a one-off manual
// convert, so the status is rare enough on screen that a dedicated filter
// isn't worth a pill; "All" already surfaces it.
const STATUS_TABS: { label: string; value: PurchaseRequestSummary['status'] | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Draft', value: 'draft' },
  { label: 'Converted', value: 'converted' },
  { label: 'Cancelled', value: 'cancelled' },
]

/** Same border treatment PurchaseOrderList's search box uses. */
const CONTROL_CHROME = {
  idle: 'border-[#d3d3db]',
  focused: 'border-[#5b21b6] shadow-[0_0_0_3px_#f0e9fc]',
}

// Reuses PurchaseOrderList's own status colours where the meaning lines up —
// draft is the same "not moving yet" grey, submitted is the same blue as a
// PO that's been sent onward, converted is the same purple as an approved
// PO, and cancelled is the same red — so the two tabs' badges never clash.
const PR_STATUS_META: Record<PurchaseRequestSummary['status'], { label: string; badge: string }> = {
  draft: { label: 'Draft', badge: 'bg-[#f1f1f4] text-[#3d3d4a]' },
  submitted: { label: 'Submitted', badge: 'bg-[#eaf0fb] text-[#1f4b99]' },
  converted: { label: 'Converted', badge: 'bg-[#f1ebfb] text-[#3f1490]' },
  cancelled: { label: 'Cancelled', badge: 'bg-[#fdeceb] text-[#b42318]' },
}

// Exported alongside the row actions below — ViewPurchaseRequestModal reuses
// all three rather than hand-rolling its own copies, so the badge and the
// buttons read identically whether they're on the row or in the detail
// panel's footer.
export function StatusBadge({ status }: { status: PurchaseRequestSummary['status'] }) {
  const meta = PR_STATUS_META[status] ?? PR_STATUS_META.draft
  return (
    <span
      className={`whitespace-nowrap rounded-[5px] px-[9px] py-[3px] text-[11.5px] font-medium ${meta.badge}`}
    >
      {meta.label}
    </span>
  )
}

export function OutlineBtn({
  label,
  icon,
  onClick,
  disabled,
  tone = 'default',
  size = 'sm',
}: {
  label: string
  icon?: React.ReactElement
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'red'
  size?: 'sm' | 'md'
}): React.ReactElement {
  const toneClass =
    tone === 'red'
      ? 'border-[#f3c9c5] text-[#b42318] hover:bg-[#fdeceb]'
      : 'border-[#d3d3db] text-[#17171c] hover:border-[#a3a3b2] hover:bg-[#f6f6f8]'
  const sizeClass = size === 'md' ? 'px-4 py-2 text-[13px]' : 'px-2.5 py-1 text-[12px]'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-md border bg-white font-medium transition-colors disabled:opacity-50 ${sizeClass} ${toneClass}`}
    >
      {icon}
      {label}
    </button>
  )
}

export function PrimaryBtn({
  label,
  icon,
  onClick,
  disabled,
  size = 'sm',
}: {
  label: string
  icon?: React.ReactElement
  onClick: () => void
  disabled?: boolean
  size?: 'sm' | 'md'
}): React.ReactElement {
  const sizeClass = size === 'md' ? 'px-4 py-2 text-[13px]' : 'px-2.5 py-1 text-[12px]'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-md bg-[#5b21b6] font-medium text-white transition-colors hover:bg-[#4a189b] disabled:opacity-50 ${sizeClass}`}
    >
      {icon}
      {label}
    </button>
  )
}

const fmtPHP = (n: number): string =>
  n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 })

/** en-PH numeric date — same short form the PO list's fmtDate uses. */
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Same freebie-excluding qty*unitPrice sum CreatePoModal/PurchaseOrderFormFields
// use for the create-form subtotal — a PR now carries firm per-line pricing,
// same as a PO would.
function prTotal(pr: PurchaseRequestSummary): number {
  return pr.lines.reduce((sum, line) => {
    if (line.isFreebie) return sum
    const qty = Number(line.quantity) || 0
    const price = Number(line.unitPrice) || 0
    return sum + qty * price
  }, 0)
}

export function PurchaseRequestList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, PROCUREMENT_PERMISSIONS.PR_CREATE)
  const canEdit = hasPermission(session, PROCUREMENT_PERMISSIONS.PR_UPDATE)
  const canCancel = hasPermission(session, PROCUREMENT_PERMISSIONS.PR_CANCEL)
  const canConvert = hasPermission(session, PROCUREMENT_PERMISSIONS.PO_CREATE)

  const {
    items,
    pagination,
    isLoading,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    page,
    setPage,
    createPR,
    isCreating,
    updatePR,
    isUpdating,
    submitPR,
    isSubmitting,
    cancelPR,
    isCancelling,
  } = usePurchaseRequests()

  const { convertFromPr, isConverting } = usePurchaseOrders()

  const [searchFocus, setSearchFocus] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingPr, setEditingPr] = useState<PurchaseRequestSummary | null>(null)
  const [submittingPr, setSubmittingPr] = useState<PurchaseRequestSummary | null>(null)
  const [convertingPr, setConvertingPr] = useState<PurchaseRequestSummary | null>(null)
  const [viewingPr, setViewingPr] = useState<PurchaseRequestSummary | null>(null)

  // Deep link from the PO list's Source column (?pr=<id>). Fetched on its own
  // rather than looked up in `items`: the PR behind a PO is converted, which
  // the default tab hides and which may sit pages into the Converted one.
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const linkedPrId = searchParams.get('pr')
  const linkedPrQuery = useQuery({
    queryKey: ['purchase-request', linkedPrId],
    queryFn: () => getPurchaseRequest(linkedPrId as string),
    enabled: !!linkedPrId,
  })

  // Derived rather than copied into state by an effect: the linked request IS
  // the open one until the reader closes it, and mirroring it into `viewingPr`
  // would just be two sources of truth for the same modal.
  const viewedPr = viewingPr ?? (linkedPrId ? (linkedPrQuery.data ?? null) : null)
  const closeViewedPr = (): void => {
    setViewingPr(null)
    // Drop the param on close, so it doesn't reopen on the next render or
    // fight the reader after a refresh. Rebuilt from the current URL rather
    // than hard-coded: this list renders both inside the procurement hub
    // (where ?tab=requests has to survive) and on its own route.
    if (!linkedPrId) return
    const rest = new URLSearchParams(searchParams.toString())
    rest.delete('pr')
    const query = rest.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  const isNoResults = !isLoading && items.length === 0
  const filtersActive = statusFilter !== undefined || search !== ''
  const clearAll = (): void => {
    setStatusFilter(undefined)
    setSearch('')
  }

  return (
    <div className={`${PLEX} min-h-screen bg-zinc-50 text-[#17171c] antialiased`}>
      <div className="mx-auto flex max-w-[1560px] flex-col gap-[14px] p-[14px] min-[1080px]:px-5 min-[1080px]:py-[22px]">
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-[21px] font-semibold tracking-[-0.015em]">Purchase Requests</h1>
            <p className="text-[13px] text-[#5b5b6b]">
              Manage and track purchase requests across your organisation
            </p>
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#5b21b6] px-4 py-[9px] text-[13px] font-medium text-white hover:bg-[#4a189b]"
            >
              <Plus className="h-4 w-4" />
              New Purchase
            </button>
          )}
        </div>

        {/* ── Filter bar ───────────────────────────────────────────────────
            Search sits above the status pills in the same card, same split
            PurchaseOrderList uses between its free-text search and its
            coarse first-cut status filter. */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#e4e4e9] bg-white p-3">
          <div
            className={`flex h-[38px] w-full max-w-[420px] items-center gap-[9px] rounded-lg border px-3 transition-colors ${
              searchFocus ? CONTROL_CHROME.focused : CONTROL_CHROME.idle
            }`}
          >
            <Search className="h-3.25 w-3.25 shrink-0 text-[#8b8b9b]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
              placeholder="Search PR number, supplier, or item…"
              className="min-w-0 flex-1 border-none bg-transparent p-0 text-[13px] text-[#17171c] outline-none placeholder:text-[#a3a3b2]"
            />
            {search !== '' && (
              <Tooltip label="Clear search" side="bottom" align="end">
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[#8b8b9b] hover:bg-[#f1f1f4] hover:text-[#3d3d4a]"
                >
                  <X className="h-3 w-3" />
                </button>
              </Tooltip>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-[7px] border-t border-[#f1f1f4] pt-3">
            {STATUS_TABS.map((tab) => {
              const on = statusFilter === tab.value
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  className={`rounded-[20px] border px-3 py-[6px] text-[12.5px] transition-colors ${
                    on
                      ? 'border-[#5b21b6] bg-[#5b21b6] font-medium text-white'
                      : 'border-transparent bg-[#f4f4f6] text-[#3d3d4a] hover:bg-[#eeeef1]'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}

            {filtersActive && (
              <button
                type="button"
                onClick={clearAll}
                className="ml-auto flex items-center gap-1.5 rounded-lg px-[11px] py-[6px] text-[12.5px] text-[#5b21b6] hover:bg-[#f1ebfb]"
              >
                <X className="h-3.5 w-3.5" />
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* ── Table card ───────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-[#e4e4e9] bg-white">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-[#a3a3b2]" />
            </div>
          ) : isNoResults ? (
            filtersActive ? (
              <div className="flex flex-col items-center gap-2 px-6 py-11 text-center">
                <div className="h-[30px] w-[30px] rounded-lg border border-[#e4e4e9] bg-[#fbfbfc]" />
                <div className="mt-1 text-[14px] font-semibold">
                  No purchase requests match your filters
                </div>
                <div className="max-w-[420px] text-[12.5px] leading-[1.55] text-[#5b5b6b]">
                  {search
                    ? `Nothing matches “${search}”. Check the PR number, or search by supplier or item instead.`
                    : 'No requests match the status filter you have applied. Clear it to see more.'}
                </div>
                <button
                  type="button"
                  onClick={clearAll}
                  className="mt-3 rounded-lg border border-[#d3d3db] bg-white px-[15px] py-[9px] text-[13px] font-medium text-[#17171c] hover:border-[#a3a3b2]"
                >
                  Clear search and filters
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 px-6 py-13 text-center">
                <div className="h-[34px] w-[34px] rounded-[9px] border border-[#ddd0f7] bg-[#f1ebfb]" />
                <div className="mt-1 text-[15px] font-semibold">No purchase requests yet</div>
                <div className="max-w-[440px] text-[12.5px] leading-[1.55] text-[#5b5b6b]">
                  Purchase requests appear here once someone raises one. Submitted requests convert
                  into a purchase order automatically.
                </div>
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="mt-3.5 rounded-lg bg-[#5b21b6] px-[15px] py-[9px] text-[13px] font-medium text-white hover:bg-[#4a189b]"
                  >
                    + New Purchase
                  </button>
                )}
              </div>
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className={`${MONO} border-b border-[#eeeef1] bg-[#fbfbfc] text-[10px] uppercase tracking-[.09em] text-[#8b8b9b]`}
                  >
                    <th className="px-4 py-[9px] text-left">Code</th>
                    <th className="px-4 py-[9px] text-left">Supplier</th>
                    <th className="px-4 py-[9px] text-left">Status</th>
                    <th className="px-4 py-[9px] text-left">Branch</th>
                    <th className="px-4 py-[9px] text-left">Lines</th>
                    <th className="px-4 py-[9px] text-right">Total</th>
                    <th className="px-4 py-[9px] text-left">Created</th>
                    <th className="px-4 py-[9px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4f4f6]">
                  {items.map((pr) => (
                    <tr
                      key={pr.id}
                      onClick={() => setViewingPr(pr)}
                      className="cursor-pointer transition-colors hover:bg-[#fcfcfd]"
                    >
                      <td className="px-4 py-[11px]">
                        <span className={`${MONO} text-[12.5px] font-medium text-[#17171c]`}>
                          {pr.code}
                        </span>
                        {pr.reason && (
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-[#8b8b9b]">
                            {pr.reason}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-[11px] text-[12.5px] text-[#3d3d4a]">
                        {pr.supplier?.name ?? <span className="text-[#a3a3b2]">—</span>}
                      </td>
                      <td className="px-4 py-[11px]">
                        <StatusBadge status={pr.status} />
                      </td>
                      <td className="px-4 py-[11px] text-[12.5px] text-[#3d3d4a]">
                        {pr.branch?.name ?? <span className="text-[#a3a3b2]">—</span>}
                      </td>
                      <td className={`${MONO} px-4 py-[11px] text-[12.5px] text-[#3d3d4a]`}>
                        {pr.lines.length}
                      </td>
                      <td
                        className={`${MONO} px-4 py-[11px] text-right text-[13px] font-semibold text-[#17171c]`}
                      >
                        {fmtPHP(prTotal(pr))}
                      </td>
                      <td className="px-4 py-[11px] text-[11.5px] text-[#8b8b9b]">
                        {fmtDate(pr.createdAt)}
                      </td>
                      <td className="px-4 py-[11px]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {pr.status === 'draft' && (
                            <>
                              {canEdit && (
                                <OutlineBtn label="Edit" onClick={() => setEditingPr(pr)} />
                              )}
                              {canCreate && (
                                <PrimaryBtn
                                  label="Submit"
                                  onClick={() => setSubmittingPr(pr)}
                                  disabled={isSubmitting}
                                />
                              )}
                              {canCancel && (
                                <OutlineBtn
                                  label="Cancel"
                                  tone="red"
                                  onClick={() => cancelPR(pr.id)}
                                  disabled={isCancelling}
                                />
                              )}
                            </>
                          )}
                          {pr.status === 'submitted' && (
                            <>
                              {canConvert && (
                                <PrimaryBtn
                                  label="Convert to PO"
                                  onClick={() => setConvertingPr(pr)}
                                  disabled={isConverting}
                                />
                              )}
                              {canCancel && (
                                <OutlineBtn
                                  label="Cancel"
                                  tone="red"
                                  onClick={() => cancelPR(pr.id)}
                                  disabled={isCancelling}
                                />
                              )}
                            </>
                          )}
                          {/* A real link straight to the PO's own detail
                              view (?po=<id>, which PurchaseOrderList opens
                              automatically) — safe to click on its own even
                              though it sits inside the actions column's
                              stopPropagation zone: that only stops the click
                              from ALSO bubbling up to the row's "open this
                              PR" handler, not from firing this button's own
                              onClick. */}
                          {pr.status === 'converted' && pr.convertedToPo && (
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/inventory/purchase-orders?tab=orders&po=${pr.convertedToPo?.id}`
                                )
                              }
                              title={`Open ${pr.convertedToPo.code}`}
                              className={`${MONO} text-[11.5px] font-medium text-[#5b21b6] underline decoration-transparent underline-offset-2 hover:decoration-current`}
                            >
                              {pr.convertedToPo.code}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* ── Pagination ─────────────────────────────────────────────── */}
              {pagination.totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-[14px] border-t border-[#e4e4e9] bg-[#fbfbfc] px-4 py-[11px]">
                  <span className="text-[11.5px] text-[#8b8b9b]">
                    Showing {(page - 1) * pagination.limit + 1}–
                    {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}{' '}
                    requests
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1}
                      className="rounded-[7px] border border-[#e4e4e9] bg-white px-[11px] py-1.5 text-[12px] text-[#17171c] disabled:text-[#a3a3b2]"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= pagination.totalPages}
                      className="rounded-[7px] border border-[#d3d3db] bg-white px-[11px] py-1.5 text-[12px] text-[#17171c] hover:border-[#a3a3b2] disabled:text-[#a3a3b2]"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreatePoModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={async (data) => {
          await createPR(data)
          setShowCreateModal(false)
        }}
        isCreating={isCreating}
        currentUserBranchId={session.branchId}
      />

      <CreatePoModal
        open={!!editingPr}
        onClose={() => setEditingPr(null)}
        pr={editingPr}
        onUpdate={async (id, data) => {
          await updatePR(id, data)
          setEditingPr(null)
        }}
        isSaving={isUpdating}
        currentUserBranchId={session.branchId}
      />

      <ConfirmActionModal
        open={submittingPr !== null}
        onClose={() => setSubmittingPr(null)}
        title="Submit Purchase Request"
        icon={<Send className="h-5 w-5" />}
        iconColorClass="text-[#5b21b6]"
        summary={<p className="text-sm font-medium text-zinc-900">{submittingPr?.code}</p>}
        message="This sends the purchase request into the approval queue — you won't be able to edit it as a draft afterward."
        confirmLabel="Submit"
        confirmingLabel="Submitting…"
        confirmButtonClass="bg-[#5b21b6] hover:bg-[#4a189b]"
        onConfirm={async () => {
          if (submittingPr) await submitPR(submittingPr.id)
        }}
        isConfirming={isSubmitting}
      />

      <ConvertPrToPoModal
        open={!!convertingPr}
        onClose={() => setConvertingPr(null)}
        pr={convertingPr}
        onConvert={async (prId, data) => {
          await convertFromPr(prId, data)
          setConvertingPr(null)
        }}
        isConverting={isConverting}
      />

      <ViewPurchaseRequestModal
        open={!!viewedPr}
        onClose={closeViewedPr}
        pr={viewedPr}
        canEdit={canEdit}
        canSubmit={canCreate}
        canCancel={canCancel}
        canConvert={canConvert}
        onEdit={(pr) => {
          closeViewedPr()
          setEditingPr(pr)
        }}
        onSubmit={(pr) => {
          closeViewedPr()
          setSubmittingPr(pr)
        }}
        onCancel={(pr) => {
          closeViewedPr()
          cancelPR(pr.id)
        }}
        onConvert={(pr) => {
          closeViewedPr()
          setConvertingPr(pr)
        }}
        onViewPo={(poId) => {
          closeViewedPr()
          router.push(`/inventory/purchase-orders?tab=orders&po=${poId}`)
        }}
      />
    </div>
  )
}
