'use client'

import { useEffect, useState } from 'react'
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

export default function SalesByBranchWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'
  const limit = isCompact ? 4 : 6

  const [branches, setBranches] = useState<SalesByBranch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    getSalesByBranch({ dateFrom: monthStart.toISOString() })
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
  }, [])

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
      <div className="flex flex-col items-center justify-center py-4 text-center">
        <p className="text-xs text-zinc-400">No sales this month yet.</p>
      </div>
    )
  }

  const top = active.slice(0, limit)
  const maxVal = Math.max(...top.map((b) => b.totalSales), 1)

  return (
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
  )
}
