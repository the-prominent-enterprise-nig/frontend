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
} from 'lucide-react'
import {
  getPendingVoidRequests,
  getBranchVoidRequests,
  approveVoidRequest,
  rejectVoidRequest,
  validateManagerByPin,
} from '../../_actions/pos-actions'
import type { PosVoidRequest } from '@/src/schema/pos'
import { PosDateTime } from '../../_components/PosDate'

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
}

const statusIcon: Record<string, React.ReactNode> = {
  pending: <Clock size={10} />,
  approved: <CheckCircle2 size={10} />,
  rejected: <XCircle size={10} />,
}

export default function VoidRequestsList({ isManager }: Props) {
  const [requests, setRequests] = useState<PosVoidRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [detailTarget, setDetailTarget] = useState<PosVoidRequest | null>(null)
  const [reviewTarget, setReviewTarget] = useState<PosVoidRequest | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [approvalPin, setApprovalPin] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [reviewError, setReviewError] = useState('')

  async function load() {
    const res = isManager ? await getPendingVoidRequests() : await getBranchVoidRequests()
    if (res.success && res.data) {
      setRequests(res.data)
      setLoadError('')
    } else if (!res.success) {
      setLoadError(res.error ?? 'Failed to load void requests.')
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 10_000)
    return () => clearInterval(interval)
  }, [])

  function openReview(req: PosVoidRequest) {
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

    const res = await approveVoidRequest(reviewTarget.id, {
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

    const res = await rejectVoidRequest(reviewTarget.id, { reviewNotes: reviewNotes.trim() })
    setReviewing(false)
    if (!res.success) {
      setReviewError(res.error ?? 'Failed to reject.')
      return
    }
    closeReview()
    load()
  }

  const emptyLabel = isManager ? 'No pending void requests' : 'No void requests yet'
  const emptySubLabel = isManager
    ? 'All caught up. This page refreshes every 10 seconds.'
    : 'Your submitted void requests will appear here.'

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Void Requests</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {isManager
            ? 'Pending cashier void requests awaiting manager approval.'
            : 'Void requests in this branch and their current status.'}
        </p>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading…
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-20 text-center">
          <CheckCircle2 size={32} className="mb-3 text-green-400" />
          <p className="font-medium text-gray-700">{emptyLabel}</p>
          <p className="mt-1 text-sm text-gray-400">{emptySubLabel}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Transaction
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Cashier
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Amount
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Reason
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Requested
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
                    <span className="text-xs text-purple-700">
                      {req.transaction?.transactionNumber ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-gray-800">{req.requestedBy?.name ?? '—'}</span>
                    {req.requestedBy?.employee?.employeeCode && (
                      <span className="ml-1.5 text-xs text-gray-400">
                        #{req.requestedBy.employee.employeeCode}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {req.transaction ? formatCurrency(req.transaction.totalAmount) : '—'}
                  </td>
                  <td className="px-5 py-3 max-w-45">
                    <p className="truncate text-gray-600 text-sm">{req.reason}</p>
                  </td>
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
                    {!isManager && req.status === 'pending' && (
                      <span className="text-xs text-amber-600 font-medium">Awaiting approval</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                  <h2 className="text-lg font-bold text-gray-900">Void Request</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {detailTarget.transaction?.transactionNumber ?? detailTarget.transactionId}
                  </p>
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
                  <span className="text-gray-900 font-medium">
                    {detailTarget.requestedBy?.name ?? '—'}
                    {detailTarget.requestedBy?.employee?.employeeCode && (
                      <span className="ml-1.5 text-xs text-gray-400">
                        #{detailTarget.requestedBy.employee.employeeCode}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-semibold text-gray-900">
                    {detailTarget.transaction
                      ? formatCurrency(detailTarget.transaction.totalAmount)
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Requested</span>
                  <span className="text-gray-700">
                    <PosDateTime iso={detailTarget.createdAt} />
                  </span>
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-gray-500">Reason</p>
                <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 leading-relaxed">
                  {detailTarget.reason}
                </p>
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
                <h2 className="text-lg font-bold text-gray-900">Review Void Request</h2>
                <p className="font-mono text-xs text-gray-500 mt-0.5">
                  {reviewTarget.transaction?.transactionNumber ?? reviewTarget.transactionId}
                </p>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Cashier</span>
                  <span className="text-gray-900 font-medium">
                    {reviewTarget.requestedBy?.name ?? '—'}
                    {reviewTarget.requestedBy?.employee?.employeeCode && (
                      <span className="ml-1.5 font-mono text-xs text-gray-400">
                        #{reviewTarget.requestedBy.employee.employeeCode}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-semibold text-gray-900">
                    {reviewTarget.transaction
                      ? formatCurrency(reviewTarget.transaction.totalAmount)
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Reason</span>
                  <span className="text-gray-700 text-right max-w-xs">{reviewTarget.reason}</span>
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
                  Approve & Void
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
