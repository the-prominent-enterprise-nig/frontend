'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, X, XCircle } from 'lucide-react'
import { purchaseRequestsApi } from '@/src/libs/api/procurement'
import type { PurchaseRequest } from '@/src/schema/procurement/types'

export default function PurchaseRequestDetail({
  id,
  currentUserId,
  canApprove,
  canReject,
  canCancel,
  canCreatePo,
}: {
  id: string
  currentUserId: string
  canApprove: boolean
  canReject: boolean
  canCancel: boolean
  canCreatePo: boolean
}) {
  const router = useRouter()
  const [pr, setPr] = useState<PurchaseRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  async function load() {
    const res = await purchaseRequestsApi.get(id)
    if (res.success && res.data) setPr(res.data)
    else setError(res.message ?? 'Not found')
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [id])

  async function approve() {
    await purchaseRequestsApi.approve(id, currentUserId)
    load()
  }
  async function reject() {
    if (!rejectReason.trim()) return
    await purchaseRequestsApi.reject(id, rejectReason)
    setRejectOpen(false)
    load()
  }
  async function cancel() {
    if (!confirm('Cancel this PR?')) return
    await purchaseRequestsApi.cancel(id)
    load()
  }

  if (loading) return <div className="px-6 py-8 text-gray-400">Loading…</div>
  if (error || !pr) return <div className="px-6 py-8 text-red-600">{error ?? 'Not found'}</div>

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/procurement/purchase-requests"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to requests
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{pr.code}</h1>
          <div className="mt-1 text-sm text-gray-500">
            Status: <span className="font-medium">{pr.status}</span>
            {pr.triggeredByReorder && ' · Auto-generated from reorder rule'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pr.status === 'submitted' && canApprove && (
            <button
              onClick={approve}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Check className="h-4 w-4" />
              Approve
            </button>
          )}
          {pr.status === 'submitted' && canReject && (
            <button
              onClick={() => setRejectOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
              Reject
            </button>
          )}
          {pr.status === 'approved' && canCreatePo && (
            <Link
              href={`/procurement/purchase-orders/new?fromPr=${pr.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-orange-700"
            >
              Convert to PO <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          {!['converted', 'rejected', 'cancelled'].includes(pr.status) && canCancel && (
            <button
              onClick={cancel}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4" />
              Cancel
            </button>
          )}
        </div>
      </header>

      {pr.reason && (
        <p className="mt-3 text-sm text-gray-700">
          <span className="font-semibold">Reason:</span> {pr.reason}
        </p>
      )}
      {pr.notes && <p className="mt-1 text-sm text-gray-500">{pr.notes}</p>}
      {pr.rejectedReason && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Rejected: {pr.rejectedReason}
        </p>
      )}

      <section className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3">Suggested supplier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-800">
            {pr.lines?.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 font-medium">{l.item?.name ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-[12px] text-gray-500">
                  {l.item?.sku ?? '—'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {Number(l.quantity).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-mono text-[12px] text-gray-500">
                  {l.suggestedSupplierId?.slice(0, 8) ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Reject PR</h2>
            <p className="mt-1 text-sm text-gray-500">Add a reason. The requestor will see this.</p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setRejectOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={reject}
                disabled={!rejectReason.trim()}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Reject PR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
