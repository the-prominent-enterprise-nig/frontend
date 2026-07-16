'use client'

import { useEffect, useMemo, useState } from 'react'
import { Clock, ChevronDown } from 'lucide-react'
import { usePosPendingRfdStore } from '@/src/stores/pos-pending-rfd.store'
import { getReleaseFormStatus } from '../_actions/pos-actions'
import { showToast } from '@/src/components/ui/toast'

const POLL_INTERVAL_MS = 12_000

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)

export function PendingRfdIndicator({ userId }: { userId: string | null }) {
  const rawEntries = usePosPendingRfdStore((s) => s.entries)
  const remove = usePosPendingRfdStore((s) => s.remove)
  const [open, setOpen] = useState(false)

  // localStorage isn't scoped per-account, so entries submitted by a
  // previously logged-in user on this same browser would otherwise leak
  // into the current account's badge/list forever (they belong to a
  // request this account may not even have visibility into).
  const entries = useMemo(
    () => (userId ? rawEntries.filter((e) => e.submittedByUserId === userId) : []),
    [rawEntries, userId]
  )

  // Prune foreign entries out of the persisted store in the background so
  // they don't keep resurfacing on every mount.
  useEffect(() => {
    if (!userId) return
    for (const e of rawEntries) {
      if (e.submittedByUserId !== userId) remove(e.releaseFormRequestId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawEntries, userId])

  useEffect(() => {
    if (entries.length === 0) return

    let cancelled = false

    async function poll() {
      for (const entry of entries) {
        const res = await getReleaseFormStatus(entry.releaseFormRequestId)
        if (cancelled || !res.success || !res.data) continue
        const { status, reviewNotes } = res.data
        if (status === 'approved') {
          remove(entry.releaseFormRequestId)
          showToast({
            title: 'Sale approved',
            description: `${entry.itemName} — ${fmt(entry.totalAmount)} released.`,
            status: 'success',
          })
        } else if (status === 'rejected') {
          remove(entry.releaseFormRequestId)
          showToast({
            title: 'Sale rejected',
            description: reviewNotes || `${entry.itemName} was not approved for release.`,
            status: 'warning',
          })
        } else if (status === 'cancelled' || status === 'expired') {
          remove(entry.releaseFormRequestId)
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
        <Clock size={13} className="shrink-0 animate-pulse text-amber-500" />
        {entries.length} awaiting approval
        <ChevronDown size={11} className="text-amber-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1.5 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Pending Manager Approval
            </p>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {entries.map((e) => (
                <div key={e.releaseFormRequestId} className="rounded-lg bg-amber-50 px-2.5 py-2">
                  <p className="truncate text-xs font-semibold text-gray-900">{e.itemName}</p>
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
