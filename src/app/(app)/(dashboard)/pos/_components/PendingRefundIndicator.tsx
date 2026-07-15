'use client'

import { useEffect, useState } from 'react'
import { Undo2, ChevronDown, X } from 'lucide-react'
import { usePosPendingRefundStore } from '@/src/stores/pos-pending-refund.store'
import { getReturnRefundStatus, cancelReturnRefundRequest } from '../_actions/pos-actions'
import { showToast } from '@/src/components/ui/toast'

const POLL_INTERVAL_MS = 12_000

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)

/** Sibling to PendingRfdIndicator — tracks this cashier's refund requests
 * that are awaiting manager approval under the new unified
 * ReturnRefundRequest model. Kept separate from the release-form indicator
 * since the two poll different endpoints/ids and only refund needed a new
 * submitter-side pending state (void/cancellation already have their own
 * pending UX on their existing pages). */
export function PendingRefundIndicator() {
  const entries = usePosPendingRefundStore((s) => s.entries)
  const remove = usePosPendingRefundStore((s) => s.remove)
  const [open, setOpen] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  async function handleCancel(returnRefundRequestId: string) {
    setCancellingId(returnRefundRequestId)
    const res = await cancelReturnRefundRequest(returnRefundRequestId)
    setCancellingId(null)
    if (!res.success) {
      showToast({
        title: 'Failed to cancel refund request',
        description: res.error,
        status: 'error',
      })
      return
    }
    remove(returnRefundRequestId)
  }

  useEffect(() => {
    if (entries.length === 0) return

    let cancelled = false

    async function poll() {
      for (const entry of entries) {
        const res = await getReturnRefundStatus(entry.returnRefundRequestId)
        if (cancelled || !res.success || !res.data) continue
        const { status, reviewNotes } = res.data
        if (status === 'approved') {
          remove(entry.returnRefundRequestId)
          showToast({
            title: 'Refund approved',
            description: `${entry.itemName} — ${fmt(entry.totalAmount)} refunded.`,
            status: 'success',
          })
        } else if (status === 'rejected') {
          remove(entry.returnRefundRequestId)
          showToast({
            title: 'Refund rejected',
            description: reviewNotes || `${entry.itemName} refund was not approved.`,
            status: 'warning',
          })
        } else if (status === 'cancelled' || status === 'expired') {
          remove(entry.returnRefundRequestId)
        }
      }
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length])

  if (entries.length === 0) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 py-1 pl-2.5 pr-2 text-xs font-medium text-amber-800"
      >
        <Undo2 size={13} className="shrink-0 animate-pulse text-amber-500" />
        {entries.length} refund{entries.length === 1 ? '' : 's'} awaiting approval
        <ChevronDown size={11} className="text-amber-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1.5 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Pending Refund Approval
            </p>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {entries.map((e) => (
                <div key={e.returnRefundRequestId} className="rounded-lg bg-amber-50 px-2.5 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-900">
                      {e.itemName}
                    </p>
                    <button
                      onClick={() => handleCancel(e.returnRefundRequestId)}
                      disabled={cancellingId === e.returnRefundRequestId}
                      title="Cancel this refund request"
                      className="shrink-0 text-gray-400 hover:text-red-500 disabled:opacity-40"
                    >
                      <X size={11} />
                    </button>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between">
                    <span className="text-[10px] text-amber-600">Waiting for review</span>
                    <span className="text-xs font-medium text-gray-700">{fmt(e.totalAmount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
