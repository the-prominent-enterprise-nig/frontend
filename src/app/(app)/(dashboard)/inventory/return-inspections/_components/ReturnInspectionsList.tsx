'use client'

import { useEffect, useState } from 'react'
import { PackageSearch, Loader2, X, ClipboardCheck } from 'lucide-react'
import {
  getPendingInspectionReturnRefundRequests,
  inspectReturnRefundRequest,
} from '../../../pos/_actions/pos-actions'
import type { PosReturnRefundRequest, PosReturnRefundType } from '@/src/schema/pos'
import { PosDateTime } from '../../../pos/_components/PosDate'
import { Skeleton } from '@/src/components/ui/Skeleton'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)
}

const typeBadge: Record<PosReturnRefundType, string> = {
  refund: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  void: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  cancellation: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
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

function referenceLabel(req: PosReturnRefundRequest): string {
  if (req.transaction) return req.transaction.transactionNumber
  const line =
    req.refundCartSnapshot?.lines?.find((l) => l.serialNumberId) ??
    req.refundCartSnapshot?.lines?.[0]
  return line?.itemName ?? '—'
}

function amountOf(req: PosReturnRefundRequest): number {
  return req.refundCartSnapshot?.totalAmount ?? req.transaction?.totalAmount ?? 0
}

function RequestRowSkeleton() {
  return (
    <tr>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-5 py-3">
          <Skeleton className="h-3.5 w-16" />
        </td>
      ))}
    </tr>
  )
}

export default function ReturnInspectionsList() {
  const [requests, setRequests] = useState<PosReturnRefundRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [inspectTarget, setInspectTarget] = useState<PosReturnRefundRequest | null>(null)
  const [inspectionNotes, setInspectionNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  async function load() {
    const res = await getPendingInspectionReturnRefundRequests()
    if (res.success && res.data) {
      setRequests(res.data)
      setLoadError('')
    } else if (!res.success) {
      setLoadError(res.error ?? 'Failed to load pending inspections.')
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 10_000)
    return () => clearInterval(interval)
  }, [])

  function openInspect(req: PosReturnRefundRequest) {
    setInspectTarget(req)
    setInspectionNotes('')
    setSubmitError('')
  }

  function closeInspect() {
    setInspectTarget(null)
    setInspectionNotes('')
    setSubmitError('')
  }

  async function handleSubmit() {
    if (!inspectTarget) return
    if (!inspectionNotes.trim()) {
      setSubmitError('Inspection notes are required.')
      return
    }
    setSubmitting(true)
    setSubmitError('')

    const res = await inspectReturnRefundRequest(inspectTarget.id, {
      inspectionNotes: inspectionNotes.trim(),
    })
    setSubmitting(false)
    if (!res.success) {
      setSubmitError(res.error ?? 'Failed to record inspection.')
      return
    }
    closeInspect()
    load()
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-prominent-purple-900">Return Inspections</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Void and refund requests awaiting physical inspection. Recording an inspection moves any
          serial-tracked unit to Quarantine and unblocks manager approval.
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
                  {['Type', 'Reference', 'Cashier', 'Branch / Terminal', 'Amount', 'Submitted'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                      >
                        {h}
                      </th>
                    )
                  )}
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
          <PackageSearch size={32} className="mb-3 text-green-400" />
          <p className="font-medium text-gray-700">No returns awaiting inspection</p>
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
                    Submitted
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50 transition-colors">
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
                    <td className="px-5 py-3 text-gray-500">
                      <PosDateTime iso={req.createdAt} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => openInspect(req)}
                        className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 ring-1 ring-purple-200 hover:bg-purple-100 transition-colors"
                      >
                        <ClipboardCheck size={11} /> Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inspect modal */}
      {inspectTarget && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => !submitting && closeInspect()}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-prominent-purple-900 capitalize">
                    Inspect {inspectTarget.type} Request
                  </h2>
                  <p className="font-mono text-xs text-gray-500 mt-0.5">{inspectTarget.id}</p>
                </div>
                <button
                  onClick={closeInspect}
                  disabled={submitting}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Cashier</span>
                  <span className="text-gray-900 font-medium">{cashierLabel(inspectTarget)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Reference</span>
                  <span className="text-gray-700 text-right">{referenceLabel(inspectTarget)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(amountOf(inspectTarget))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Reason</span>
                  <span className="text-gray-700 text-right">{inspectTarget.reason ?? '—'}</span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Inspection notes <span className="text-gray-400">(required)</span>
                </label>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 resize-none"
                  placeholder="Unit powers on, minor scuff on casing, no missing accessories…"
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  disabled={submitting}
                  autoFocus
                />
              </div>

              {submitError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  onClick={closeInspect}
                  disabled={submitting}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !inspectionNotes.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <ClipboardCheck size={13} />
                  )}
                  Submit Inspection
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
