'use client'

import { useEffect, useState } from 'react'
import {
  ShieldCheck,
  ShieldOff,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  KeyRound,
  X,
  PackageCheck,
} from 'lucide-react'
import {
  getPendingReturnRefundRequests,
  approveReturnRefundRequest,
  rejectReturnRefundRequest,
  validateManagerByPin,
} from '../../_actions/pos-actions'
import type {
  PosReturnRefundRequest,
  PosReturnRefundType,
  PosReleaseFormCartLine,
} from '@/src/schema/pos'
import { PosDateTime } from '../../_components/PosDate'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { Skeleton } from '@/src/components/ui/Skeleton'

interface Props {
  isManager: boolean
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)
}

const statusBadge: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  approved: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  rejected: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  cancelled: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
  expired: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
}

const statusIcon: Record<string, React.ReactNode> = {
  pending: <Clock size={10} />,
  approved: <CheckCircle2 size={10} />,
  rejected: <XCircle size={10} />,
  cancelled: <XCircle size={10} />,
  expired: <XCircle size={10} />,
}

const typeBadge: Record<PosReturnRefundType, string> = {
  refund: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  void: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  cancellation: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
}

const approveLabel: Record<PosReturnRefundType, string> = {
  refund: 'Approve & Refund',
  void: 'Approve & Void',
  cancellation: 'Approve & Cancel',
}

/** The line the row/cards key off — first line flagged serial-tracked, or
 * failing that just the first line in the snapshot. Only present for
 * cart-snapshot based requests (refund/cancellation), not void. */
function primaryLine(req: PosReturnRefundRequest): PosReleaseFormCartLine | undefined {
  const lines = req.refundCartSnapshot?.lines ?? []
  return lines.find((l) => l.serialNumberId) ?? lines[0]
}

function shortId(id?: string | null): string {
  if (!id) return '—'
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

function cashierLabel(req: PosReturnRefundRequest): string {
  return req.requestedBy?.name ?? req.session?.cashier?.name ?? shortId(req.requestedById)
}

function branchTerminalLabel(req: PosReturnRefundRequest): string {
  const branch = req.session?.terminal?.branch?.name
  const terminal = req.session?.terminal?.terminalCode ?? req.session?.terminal?.name
  if (branch && terminal) return `${branch} · ${terminal}`
  return branch ?? terminal ?? shortId(req.sessionId)
}

function customerLabel(req: PosReturnRefundRequest): string {
  return (
    req.refundCartSnapshot?.customer?.name ??
    (req.refundCartSnapshot?.customerId ? shortId(req.refundCartSnapshot.customerId) : 'Walk-in')
  )
}

/** Void requests are transaction-based (no cart snapshot); refund/cancellation
 * are cart-snapshot based. Reference reads whichever the row type has. */
function referenceLabel(req: PosReturnRefundRequest): string {
  if (req.transaction) return req.transaction.transactionNumber
  const line = primaryLine(req)
  return line?.itemName ?? '—'
}

function amountOf(req: PosReturnRefundRequest): number {
  return req.refundCartSnapshot?.totalAmount ?? req.transaction?.totalAmount ?? 0
}

function RequestRowSkeleton() {
  return (
    <tr>
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-5 py-3">
          <Skeleton className="h-3.5 w-16" />
        </td>
      ))}
    </tr>
  )
}

export default function ReturnRefundApprovalsList({ isManager }: Props) {
  const { branchId } = usePosBranchContext()
  const [requests, setRequests] = useState<PosReturnRefundRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [detailTarget, setDetailTarget] = useState<PosReturnRefundRequest | null>(null)
  const [reviewTarget, setReviewTarget] = useState<PosReturnRefundRequest | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [approvalPin, setApprovalPin] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [reviewError, setReviewError] = useState('')

  async function load() {
    const res = await getPendingReturnRefundRequests(branchId ?? undefined)
    if (res.success && res.data) {
      setRequests(res.data)
      setLoadError('')
    } else if (!res.success) {
      setLoadError(res.error ?? 'Failed to load return/refund approvals.')
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 10_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId])

  function openReview(req: PosReturnRefundRequest) {
    setDetailTarget(null)
    setReviewTarget(req)
    setReviewNotes('')
    setApprovalPin('')
    setReviewError('')
  }

  function closeReview() {
    setReviewTarget(null)
    setReviewNotes('')
    setApprovalPin('')
    setReviewError('')
  }

  async function handleApprove() {
    if (!reviewTarget) return
    if (!approvalPin.trim()) {
      setReviewError('Your PIN is required to approve.')
      return
    }
    setReviewing(true)
    setReviewError('')

    const pinRes = await validateManagerByPin(approvalPin.trim())
    if (!pinRes.success || !pinRes.data?.valid) {
      setReviewError(pinRes.error ?? 'Invalid PIN. Please try again.')
      setReviewing(false)
      return
    }

    const res = await approveReturnRefundRequest(reviewTarget.id, {
      reviewNotes: reviewNotes.trim() || `Approved by ${pinRes.data.managerName}`,
    })
    setReviewing(false)
    if (!res.success) {
      setReviewError(res.error ?? 'Failed to approve.')
      return
    }
    closeReview()
    load()
  }

  async function handleReject() {
    if (!reviewTarget) return
    if (!reviewNotes.trim()) {
      setReviewError('Please provide a reason for rejection.')
      return
    }
    if (!approvalPin.trim()) {
      setReviewError('Your PIN is required to reject.')
      return
    }
    setReviewing(true)
    setReviewError('')

    const pinRes = await validateManagerByPin(approvalPin.trim())
    if (!pinRes.success || !pinRes.data?.valid) {
      setReviewError(pinRes.error ?? 'Invalid PIN. Please try again.')
      setReviewing(false)
      return
    }

    const res = await rejectReturnRefundRequest(reviewTarget.id, {
      reviewNotes: reviewNotes.trim(),
    })
    setReviewing(false)
    if (!res.success) {
      setReviewError(res.error ?? 'Failed to reject.')
      return
    }
    closeReview()
    load()
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Return & Refund Approvals</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Cancellations, voids, and refunds awaiting manager approval before they take effect.
        </p>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {[
                    'Type',
                    'Reference',
                    'Cashier',
                    'Branch / Terminal',
                    'Amount',
                    'Customer',
                    'Submitted',
                    'Status',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                    >
                      {h}
                    </th>
                  ))}
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Array.from({ length: 5 }).map((_, i) => (
                  <RequestRowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-20 text-center">
          <PackageCheck size={32} className="mb-3 text-green-400" />
          <p className="font-medium text-gray-700">No pending return/refund requests</p>
          <p className="mt-1 text-sm text-gray-400">
            All caught up. This page refreshes every 10 seconds.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Type
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Reference
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Cashier
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Branch / Terminal
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Amount
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Customer
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Submitted
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => setDetailTarget(req)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${typeBadge[req.type]}`}
                      >
                        {req.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">{referenceLabel(req)}</td>
                    <td className="px-5 py-3 text-gray-800">{cashierLabel(req)}</td>
                    <td className="px-5 py-3 text-gray-600">{branchTerminalLabel(req)}</td>
                    <td className="px-5 py-3 font-semibold text-gray-900">
                      {formatCurrency(amountOf(req))}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{customerLabel(req)}</td>
                    <td className="px-5 py-3 text-gray-500">
                      <PosDateTime iso={req.createdAt} />
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${statusBadge[req.status] ?? ''}`}
                      >
                        {statusIcon[req.status]}
                        {req.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {isManager && req.status === 'pending' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openReview(req)
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 ring-1 ring-purple-200 hover:bg-purple-100 transition-colors"
                        >
                          <ShieldCheck size={11} /> Review
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detailTarget && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setDetailTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 capitalize">
                    {detailTarget.type} Request
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">{detailTarget.id}</p>
                </div>
                <button
                  onClick={() => setDetailTarget(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${statusBadge[detailTarget.status] ?? ''}`}
                  >
                    {statusIcon[detailTarget.status]}
                    {detailTarget.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cashier</span>
                  <span className="text-gray-900 font-medium">{cashierLabel(detailTarget)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Branch / Terminal</span>
                  <span className="text-gray-900">{branchTerminalLabel(detailTarget)}</span>
                </div>
                {detailTarget.transaction && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Transaction</span>
                    <span className="text-gray-900 font-mono text-xs">
                      {detailTarget.transaction.transactionNumber}
                    </span>
                  </div>
                )}
                {!detailTarget.transaction && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Customer</span>
                    <span className="text-gray-900">{customerLabel(detailTarget)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Submitted</span>
                  <span className="text-gray-700">
                    <PosDateTime iso={detailTarget.createdAt} />
                  </span>
                </div>
              </div>

              {detailTarget.reason && (
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-500">Reason</p>
                  <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 leading-relaxed">
                    {detailTarget.reason}
                  </p>
                </div>
              )}

              {detailTarget.refundCartSnapshot?.lines &&
                detailTarget.refundCartSnapshot.lines.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-gray-500">Items</p>
                    <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                      {detailTarget.refundCartSnapshot.lines.map((line, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-3 py-2 text-sm"
                        >
                          <p className="truncate font-medium text-gray-800">{line.itemName}</p>
                          <div className="shrink-0 text-right text-gray-600">
                            <p>
                              {line.quantity} × {formatCurrency(line.unitPrice)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <div className="mt-2 flex justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900">
                <span>Amount</span>
                <span>{formatCurrency(amountOf(detailTarget))}</span>
              </div>

              {detailTarget.reviewNotes && (
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-500">Review notes</p>
                  <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 leading-relaxed">
                    {detailTarget.reviewNotes}
                  </p>
                </div>
              )}

              {isManager && detailTarget.status === 'pending' && (
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => openReview(detailTarget)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                  >
                    <ShieldCheck size={13} /> Review
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Review modal — manager only */}
      {isManager && reviewTarget && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => !reviewing && closeReview()}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 capitalize">
                  Review {reviewTarget.type} Request
                </h2>
                <p className="font-mono text-xs text-gray-500 mt-0.5">{reviewTarget.id}</p>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Cashier</span>
                  <span className="text-gray-900 font-medium">{cashierLabel(reviewTarget)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Reference</span>
                  <span className="text-gray-700 text-right">{referenceLabel(reviewTarget)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(amountOf(reviewTarget))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Requested</span>
                  <span className="text-gray-700">
                    <PosDateTime iso={reviewTarget.createdAt} />
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Notes <span className="text-gray-400">(required for rejection)</span>
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 resize-none"
                  placeholder="Add notes…"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  disabled={reviewing}
                />
              </div>

              <div className="rounded-xl border border-purple-100 bg-purple-50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <KeyRound size={13} className="text-purple-600" />
                  <p className="text-xs font-semibold text-purple-700">
                    Manager / Owner PIN required
                  </p>
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono tracking-widest text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                  placeholder="••••"
                  value={approvalPin}
                  onChange={(e) => setApprovalPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => e.key === 'Enter' && handleApprove()}
                  disabled={reviewing}
                />
              </div>

              {reviewError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{reviewError}</p>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  onClick={closeReview}
                  disabled={reviewing}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={reviewing || !approvalPin.trim()}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  {reviewing ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <ShieldOff size={13} />
                  )}
                  Reject
                </button>
                <button
                  onClick={handleApprove}
                  disabled={reviewing || !approvalPin.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {reviewing ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={13} />
                  )}
                  {approveLabel[reviewTarget.type]}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
