'use client'

import { useEffect, useState } from 'react'
import { useWidgetSize } from '../WidgetSizeContext'
import { getTransactions } from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'
import { customersApi } from '@/src/libs/api/crm'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import type { PosTransaction } from '@/src/schema/pos'

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700',
  voided: 'bg-red-100 text-red-600',
}

function fmtDate(dateStr?: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

function fmtMoney(n: number | string | null | undefined): string {
  const val = Number(n ?? 0)
  if (!Number.isFinite(val)) return '—'
  if (val >= 1_000_000) return `₱${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `₱${(val / 1_000).toFixed(0)}K`
  return `₱${Math.round(val).toLocaleString()}`
}

export default function RecentOrdersWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'
  const limit = isCompact ? 3 : 5

  const [transactions, setTransactions] = useState<PosTransaction[]>([])
  const [customerNames, setCustomerNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const branchId = usePosBranchContext((s) => s.branchId)

  useEffect(() => {
    let cancelled = false
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    Promise.all([
      getTransactions({ dateFrom: thirtyDaysAgo.toISOString(), branchId: branchId ?? undefined }),
      customersApi.list({ limit: 200 }),
    ])
      .then(([txRes, custRes]) => {
        if (cancelled) return
        setTransactions(txRes.data ?? [])
        setCustomerNames(new Map((custRes.data?.data ?? []).map((c) => [c.id, c.name] as const)))
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
            <div className="flex-1 space-y-1">
              <div className="h-2.5 w-24 rounded bg-zinc-100 animate-pulse" />
              <div className="h-2 w-20 rounded bg-zinc-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4 text-center">
        <p className="text-xs text-zinc-400">No transactions yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {transactions.slice(0, limit).map((t) => {
        const customerName = t.customerId
          ? (customerNames.get(t.customerId) ?? 'Customer')
          : 'Walk-in Customer'
        return (
          <div
            key={t.id}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 transition"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-zinc-800">{t.transactionNumber}</p>
              {!isCompact && <p className="truncate text-[10px] text-zinc-500">{customerName}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!isCompact && (
                <span className="text-[10px] text-zinc-400">{fmtDate(t.occurredAt)}</span>
              )}
              <span
                className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${STATUS_STYLES[t.status] ?? 'bg-zinc-100 text-zinc-600'}`}
              >
                {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
              </span>
              <span className="text-xs font-semibold text-zinc-700">{fmtMoney(t.totalAmount)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
