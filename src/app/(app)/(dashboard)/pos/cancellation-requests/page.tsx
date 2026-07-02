'use client'

import { useState, useEffect, useCallback } from 'react'
import { ClipboardX, CheckCircle2, XCircle, Loader2, AlertTriangle, Clock } from 'lucide-react'
import {
  getPendingCancellationRequests,
  approveCancellationRequest,
  rejectCancellationRequest,
} from '../_actions/pos-actions'
import type { PosCancellationRequest } from '@/src/schema/pos'

export default function CancellationRequestsPage() {
  const [requests, setRequests] = useState<PosCancellationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [acting, setActing] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await getPendingCancellationRequests()
    setLoading(false)
    if (res.success && res.data) setRequests(res.data)
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [load])

  async function handleApprove(req: PosCancellationRequest) {
    setActing((p) => ({ ...p, [req.id]: true }))
    setError('')
    const res = await approveCancellationRequest(req.id, { reviewNotes: reviewNotes[req.id] })
    setActing((p) => ({ ...p, [req.id]: false }))
    if (!res.success) {
      setError(res.error ?? 'Failed to approve')
      return
    }
    setRequests((p) => p.filter((r) => r.id !== req.id))
  }

  async function handleReject(req: PosCancellationRequest) {
    setActing((p) => ({ ...p, [req.id]: true }))
    setError('')
    const res = await rejectCancellationRequest(req.id, { reviewNotes: reviewNotes[req.id] })
    setActing((p) => ({ ...p, [req.id]: false }))
    if (!res.success) {
      setError(res.error ?? 'Failed to reject')
      return
    }
    setRequests((p) => p.filter((r) => r.id !== req.id))
  }

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <ClipboardX size={18} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cancellation Requests</h1>
            <p className="text-sm text-gray-500">
              Review and approve or reject cashier cancellation requests.
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-purple-500" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
            <CheckCircle2 size={32} className="text-green-400" />
            <p className="text-sm font-medium text-gray-500">No pending cancellation requests.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => {
              const cartItems = req.cartSnapshot ?? []
              const cashierName = req.session?.cashier?.name ?? 'Unknown cashier'
              const branchName = req.session?.terminal?.branch?.name
              const terminal = req.session?.terminal?.terminalCode
              const submittedAt = new Date(req.createdAt).toLocaleString('en-PH', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })

              return (
                <div
                  key={req.id}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                >
                  {/* Info header */}
                  <div className="border-b border-gray-100 px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{cashierName}</p>
                        <p className="text-xs text-gray-500">
                          {[branchName, terminal].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">
                        <Clock size={11} />
                        {submittedAt}
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg bg-gray-50 px-4 py-3">
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        Grounds
                      </p>
                      <p className="text-sm text-gray-800">{req.reason}</p>
                    </div>

                    {cartItems.length > 0 && (
                      <div className="mt-3">
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          Items in cart ({cartItems.length})
                        </p>
                        <div className="space-y-1">
                          {cartItems.map((item, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-xs text-gray-600"
                            >
                              <span>{String(item.itemName ?? item.itemId)}</span>
                              <span className="text-gray-400">× {String(item.quantity)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Review actions */}
                  <div className="space-y-3 px-5 py-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Review Notes (optional)
                      </label>
                      <input
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                        placeholder="e.g. Confirmed with cashier"
                        value={reviewNotes[req.id] ?? ''}
                        onChange={(e) =>
                          setReviewNotes((p) => ({ ...p, [req.id]: e.target.value }))
                        }
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleReject(req)}
                        disabled={acting[req.id]}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      >
                        {acting[req.id] ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <XCircle size={11} />
                        )}
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprove(req)}
                        disabled={acting[req.id]}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {acting[req.id] ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={11} />
                        )}
                        Approve Cancellation
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
