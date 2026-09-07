'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useWidgetSize } from '../WidgetSizeContext'
import {
  getSalesByBranch,
  type SalesByBranch,
} from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₱${(n / 1_000).toFixed(0)}K`
  return `₱${Math.round(n).toLocaleString()}`
}

type Period = '7d' | '30d' | '90d' | 'all'

const PERIODS: { id: Period; label: string }[] = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: 'all', label: 'All' },
]

function dateFromFor(period: Period): string | undefined {
  if (period === 'all') return undefined
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const from = new Date()
  from.setDate(from.getDate() - days)
  return from.toISOString()
}

// Defaults to "All" rather than the current-month window the rest of the
// dashboard's date-scoped widgets used to assume — seed/demo data (and a
// real business's early history) is often clustered on a few fixed dates
// that a rolling window can miss entirely, which reads as "broken" rather
// than "no recent sales." The toggle still lets a growing business narrow
// in on a recent trend once there's enough history to make one interesting.
export default function SalesByBranchWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'
  const limit = isCompact ? 4 : 6

  const [period, setPeriod] = useState<Period>('all')
  const [branches, setBranches] = useState<SalesByBranch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    // No setLoading(true) reset here — switching periods quietly refetches
    // in place rather than flashing the skeleton over the previous bars,
    // the same anti-flicker pattern used elsewhere on this dashboard.
    getSalesByBranch({ dateFrom: dateFromFor(period) })
      .then((res) => {
        if (cancelled) return
        setBranches(res.data ?? [])
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [period])

  const periodToggle = (
    <div className="flex items-center gap-0.5 rounded-lg bg-zinc-100 p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => setPeriod(p.id)}
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition ${
            period === p.id
              ? 'bg-white text-zinc-800 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-600'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-6 rounded-lg bg-zinc-100 animate-pulse" />
        ))}
      </div>
    )
  }

  const active = branches.filter((b) => b.totalSales > 0)

  if (active.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {!isCompact && <div className="flex justify-end">{periodToggle}</div>}
        <div className="flex flex-col items-center justify-center gap-1 py-4 text-center">
          <p className="text-xs text-zinc-400">No sales in the selected period.</p>
          <Link href="/pos" className="text-xs font-medium text-purple-600 hover:underline">
            Open POS →
          </Link>
        </div>
      </div>
    )
  }

  const top = active.slice(0, limit)
  const maxVal = Math.max(...top.map((b) => b.totalSales), 1)

  return (
    <div className="flex flex-col gap-2">
      {!isCompact && <div className="flex justify-end">{periodToggle}</div>}
      <div className="flex flex-col gap-1.5">
        {top.map((b) => {
          const pct = (b.totalSales / maxVal) * 100
          return (
            <div key={b.branchId} className="flex items-center gap-2">
              <p
                className={`shrink-0 truncate text-zinc-600 ${isCompact ? 'w-14 text-[10px]' : 'w-20 text-[11px]'}`}
                title={b.branchName}
              >
                {b.branchName}
              </p>
              <div className="h-2 flex-1 rounded-full bg-zinc-100">
                <div
                  className="h-2 rounded-full bg-purple-500"
                  style={{ width: `${Math.max(pct, 3)}%` }}
                />
              </div>
              <p
                className={`shrink-0 text-right font-semibold text-zinc-800 ${isCompact ? 'w-11 text-[10px]' : 'w-14 text-[11px]'}`}
              >
                {fmtMoney(b.totalSales)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
