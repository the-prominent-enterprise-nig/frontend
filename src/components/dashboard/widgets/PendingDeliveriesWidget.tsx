'use client'

import { useEffect, useState } from 'react'
import { PackageCheck, Bookmark } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'
import { getSkuReservations } from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import type { SkuReservation } from '@/src/schema/pos'

const STATUS_STYLES: Record<string, { bg: string; icon: typeof PackageCheck; label: string }> = {
  open: { bg: 'bg-zinc-100 text-zinc-600', icon: Bookmark, label: 'Open' },
  earmarked: { bg: 'bg-blue-100 text-blue-700', icon: PackageCheck, label: 'Earmarked' },
}

function fmtDate(dateStr?: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

function fmtMoney(n: number): string {
  return `₱${Math.round(n).toLocaleString()}`
}

export default function PendingDeliveriesWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'
  const limit = isCompact ? 3 : 4

  const [reservations, setReservations] = useState<SkuReservation[]>([])
  const [loading, setLoading] = useState(true)
  const branchId = usePosBranchContext((s) => s.branchId)

  useEffect(() => {
    let cancelled = false
    getSkuReservations(branchId ? { branchId } : undefined)
      .then((res) => {
        if (cancelled) return
        const pending = (res.data ?? [])
          .filter((r) => r.status === 'open' || r.status === 'earmarked')
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        setReservations(pending)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [branchId])

  if (loading) {
    return (
      <div className="flex flex-col gap-0.5">
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            <div className="h-6 w-6 rounded-full bg-zinc-100 animate-pulse shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-2.5 w-24 rounded bg-zinc-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (reservations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4 text-center">
        <p className="text-xs text-zinc-400">No pending reservations</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {reservations.slice(0, limit).map((r) => {
        const style = STATUS_STYLES[r.status] ?? STATUS_STYLES.open!
        const Icon = style.icon
        const itemLabel = r.item?.name ?? 'Item'
        const customerLabel = r.customer?.name ?? 'Customer'
        return (
          <div
            key={r.id}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 transition"
          >
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${style.bg}`}
            >
              <Icon className="h-3 w-3" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-900">
                {itemLabel}
                {r.quantity > 1 ? ` ×${r.quantity}` : ''}
              </p>
              {!isCompact && (
                <p className="truncate text-[10px] text-zinc-500">
                  {customerLabel} · {fmtMoney(r.amountPaid)} paid
                </p>
              )}
            </div>
            <p className="text-[10px] text-zinc-400 shrink-0 whitespace-nowrap">
              {fmtDate(r.createdAt)}
            </p>
          </div>
        )
      })}
    </div>
  )
}
