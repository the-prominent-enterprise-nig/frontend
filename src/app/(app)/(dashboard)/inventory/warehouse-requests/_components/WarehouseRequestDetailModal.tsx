'use client'

import { useState } from 'react'
import { X, Loader2, ArrowRight, Package, Check } from 'lucide-react'
import type { WarehouseRequestSummary } from '@/src/schema/inventory/warehouse-requests'
import type { ReceiveWarehouseRequestLine } from '../_actions/receive-warehouse-request'
import type { ApiResponse } from '@/src/libs/api/client'

type Props = {
  isOpen: boolean
  request: WarehouseRequestSummary | null | undefined
  isLoading: boolean
  onClose: () => void
  canReceive: boolean
  canCancel: boolean
  canAccept: boolean
  canReject: boolean
  canDispatch: boolean
  onReceive: (id: string, lines: ReceiveWarehouseRequestLine[]) => Promise<ApiResponse<unknown>>
  onCancel: (id: string) => Promise<ApiResponse<unknown>>
  onAccept: (id: string) => Promise<ApiResponse<unknown>>
  onReject: (id: string, reason: string) => Promise<ApiResponse<unknown>>
  onDispatch: (id: string) => Promise<ApiResponse<unknown>>
  isReceiving: boolean
  isCancelling: boolean
  isAccepting: boolean
  isRejecting: boolean
  isDispatching: boolean
  // null/undefined = Head Office / Business Owner, unrestricted.
  currentUserBranchId?: string | null
  // The region of the caller's own branch — drives whether they can act on
  // *this* warehouse's queue (accept/reject/dispatch). null/undefined for
  // an unrestricted caller, or a branch with no region set.
  currentUserRegion?: string | null
}

const STATUS_LABEL: Record<string, string> = {
  requested: 'Requested',
  ready: 'Ready to Dispatch',
  rejected: 'Rejected',
  in_transit: 'In Transit',
  received: 'Received',
  partially_received: 'Partially Received',
  cancelled: 'Cancelled',
}

const STATUS_COLOR: Record<string, string> = {
  requested: 'bg-purple-100 text-purple-700',
  ready: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-600',
  in_transit: 'bg-amber-100 text-amber-700',
  received: 'bg-green-100 text-green-700',
  partially_received: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-zinc-100 text-zinc-500',
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-400">{label}</p>
      <p className="mt-0.5 text-sm text-zinc-800">{value ?? '—'}</p>
    </div>
  )
}

function fmtDate(d: string | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function WarehouseRequestDetailModal({
  isOpen,
  request,
  isLoading,
  onClose,
  canReceive,
  canCancel,
  canAccept,
  canReject,
  canDispatch,
  onReceive,
  onCancel,
  onAccept,
  onReject,
  onDispatch,
  isReceiving,
  isCancelling,
  isAccepting,
  isRejecting,
  isDispatching,
  currentUserBranchId,
  currentUserRegion,
}: Props) {
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showReceiveForm, setShowReceiveForm] = useState(false)
  const [receiveChecks, setReceiveChecks] = useState<Record<string, boolean>>({})

  // This modal stays mounted across opens (isOpen just toggles), so the
  // reject/receive forms' local state would otherwise leak from one request
  // into whichever one is opened next. Reset during render (React's
  // documented "adjusting state when a prop changes" pattern) rather than in
  // an effect, which would cause an extra, avoidable render pass.
  const [lastRequestId, setLastRequestId] = useState(request?.id)
  if (request?.id !== lastRequestId) {
    setLastRequestId(request?.id)
    setShowRejectForm(false)
    setRejectReason('')
    setShowReceiveForm(false)
    setReceiveChecks({})
  }

  if (!isOpen) return null

  const inBranchScope = !currentUserBranchId || request?.branchId === currentUserBranchId
  // Warehouse-side actions (accept/reject/dispatch) are region-matched, not
  // branch-matched — any Stock Controller whose own branch shares a region
  // with the warehouse can work its queue, per the backend's own rule.
  const inWarehouseRegion = !currentUserBranchId || request?.warehouse?.region === currentUserRegion

  const showReceive = request?.status === 'in_transit' && canReceive && inBranchScope
  const showCancel =
    (request?.status === 'requested' || request?.status === 'ready') &&
    canCancel &&
    (inBranchScope || inWarehouseRegion)
  const showAccept = request?.status === 'requested' && canAccept && inWarehouseRegion
  const showReject = request?.status === 'requested' && canReject && inWarehouseRegion
  const showDispatch = request?.status === 'ready' && canDispatch && inWarehouseRegion

  async function handleReject() {
    if (!request || !rejectReason.trim()) return
    const result = await onReject(request.id, rejectReason.trim())
    if (result.success) {
      setShowRejectForm(false)
      setRejectReason('')
    }
  }

  function openReceiveForm() {
    if (!request) return
    // Defaults every line to "arrived" — matches the old one-click
    // behavior for the common case, while letting the branch uncheck
    // anything that's actually missing before confirming.
    setReceiveChecks(Object.fromEntries((request.lines ?? []).map((line) => [line.id, true])))
    setShowReceiveForm(true)
  }

  function toggleReceiveCheck(lineId: string) {
    setReceiveChecks((prev) => ({ ...prev, [lineId]: !prev[lineId] }))
  }

  async function handleReceive() {
    if (!request) return
    const lines = (request.lines ?? []).map((line) => ({
      warehouseRequestLineId: line.id,
      quantityReceived: receiveChecks[line.id] ? Number(line.quantity) : 0,
    }))
    const result = await onReceive(request.id, lines)
    if (result.success) {
      setShowReceiveForm(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {request?.requestNumber ?? 'Warehouse Request'}
            </h2>
            {request && (
              <span
                className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[request.status] ?? 'bg-zinc-100 text-zinc-600'}`}
              >
                {STATUS_LABEL[request.status] ?? request.status}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading || !request ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
          </div>
        ) : (
          <div className="space-y-5 px-6 py-5">
            <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700">
              <span>{request.warehouse?.name ?? '—'}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
              <span>{request.branch?.name ?? '—'}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Requested By" value={request.requestedByIdName} />
              <InfoRow label="Requested At" value={fmtDate(request.requestedAt)} />
              {request.acceptedAt && (
                <>
                  <InfoRow label="Accepted By" value={request.acceptedByIdName} />
                  <InfoRow label="Accepted At" value={fmtDate(request.acceptedAt)} />
                </>
              )}
              {request.rejectedAt && (
                <>
                  <InfoRow label="Rejected By" value={request.rejectedByIdName} />
                  <InfoRow label="Rejected At" value={fmtDate(request.rejectedAt)} />
                </>
              )}
              {request.dispatchedAt && (
                <>
                  <InfoRow label="Dispatched By" value={request.dispatchedByIdName} />
                  <InfoRow label="Dispatched At" value={fmtDate(request.dispatchedAt)} />
                </>
              )}
              {request.receivedAt && (
                <>
                  <InfoRow label="Received By" value={request.receivedByIdName} />
                  <InfoRow label="Received At" value={fmtDate(request.receivedAt)} />
                </>
              )}
              {request.cancelledAt && (
                <>
                  <InfoRow label="Cancelled By" value={request.cancelledByIdName} />
                  <InfoRow label="Cancelled At" value={fmtDate(request.cancelledAt)} />
                </>
              )}
            </div>

            {request.rejectedReason && (
              <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                <span className="font-medium">Rejection reason: </span>
                {request.rejectedReason}
              </div>
            )}

            {request.notes && (
              <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-sm text-zinc-600">
                <span className="font-medium">Notes: </span>
                {request.notes}
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-medium text-zinc-700">
                {showReceiveForm ? 'Confirm what arrived' : 'Items'}
              </p>
              <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-100">
                {(request.lines ?? []).map((line) => {
                  const isChecked = receiveChecks[line.id] ?? true
                  return (
                    <div
                      key={line.id}
                      className={`flex items-center gap-3 px-3 py-2 text-sm ${
                        showReceiveForm ? 'cursor-pointer hover:bg-zinc-50' : ''
                      }`}
                      onClick={showReceiveForm ? () => toggleReceiveCheck(line.id) : undefined}
                    >
                      {showReceiveForm ? (
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            isChecked
                              ? 'border-green-600 bg-green-600 text-white'
                              : 'border-zinc-300'
                          }`}
                        >
                          {isChecked && <Check className="h-3 w-3" />}
                        </span>
                      ) : (
                        <Package className="h-4 w-4 shrink-0 text-zinc-300" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate font-medium ${
                            showReceiveForm && !isChecked
                              ? 'text-zinc-400 line-through'
                              : 'text-zinc-800'
                          }`}
                        >
                          {line.item?.name ?? line.itemId}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {line.item?.sku}
                          {line.serialNumber?.serialNumber && (
                            <span className="ml-1.5 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-600">
                              {line.serialNumber.serialNumber}
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="font-semibold text-zinc-700">{Number(line.quantity)}</span>
                    </div>
                  )
                })}
              </div>
              {showReceiveForm && (
                <p className="mt-1.5 text-xs text-zinc-400">
                  Uncheck anything that didn&apos;t arrive — it&apos;ll be flagged as missing.
                </p>
              )}
            </div>

            {showReject && showRejectForm && (
              <div className="space-y-2 rounded-lg border border-red-100 bg-red-50 p-3">
                <label htmlFor="reject-reason" className="block text-xs font-medium text-red-700">
                  Reason for rejecting <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. Not enough stock to spare right now"
                  className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRejectForm(false)
                      setRejectReason('')
                    }}
                    disabled={isRejecting}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={isRejecting || !rejectReason.trim()}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {isRejecting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirm Rejection
                  </button>
                </div>
              </div>
            )}

            {(showReceive ||
              showCancel ||
              showAccept ||
              (showReject && !showRejectForm) ||
              showDispatch) && (
              <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-4">
                {showCancel && (
                  <button
                    type="button"
                    onClick={() => onCancel(request.id)}
                    disabled={isCancelling}
                    className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    {isCancelling && <Loader2 className="h-4 w-4 animate-spin" />}
                    Cancel Request
                  </button>
                )}
                {showReject && !showRejectForm && (
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(true)}
                    className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Reject
                  </button>
                )}
                {showAccept && (
                  <button
                    type="button"
                    onClick={() => onAccept(request.id)}
                    disabled={isAccepting}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {isAccepting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Accept
                  </button>
                )}
                {showDispatch && (
                  <button
                    type="button"
                    onClick={() => onDispatch(request.id)}
                    disabled={isDispatching}
                    className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                  >
                    {isDispatching && <Loader2 className="h-4 w-4 animate-spin" />}
                    Dispatch
                  </button>
                )}
                {showReceive && !showReceiveForm && (
                  <button
                    type="button"
                    onClick={openReceiveForm}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Receive
                  </button>
                )}
                {showReceive && showReceiveForm && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowReceiveForm(false)}
                      disabled={isReceiving}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleReceive}
                      disabled={isReceiving}
                      className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                    >
                      {isReceiving && <Loader2 className="h-4 w-4 animate-spin" />}
                      Confirm Receipt
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
