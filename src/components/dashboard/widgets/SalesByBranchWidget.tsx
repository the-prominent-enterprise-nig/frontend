'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useWidgetSize, useWidgetHeader } from '../WidgetSizeContext'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { getTransactions } from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'
import { useDashboardSalesByBranch } from './dashboardQueries'

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

const TREND_BUCKETS = 10

/** Splits the selected period into TREND_BUCKETS equal-width slices and sums
 * this branch's sales into each — the single-branch view's sparkline. Fires
 * its own request (individual transactions, not the per-branch aggregate
 * the rest of the widget uses) since bucketing needs each sale's own
 * timestamp, not just a period total. "All" has no fixed start, so it uses
 * the earliest transaction actually returned as the range start. */
function useBranchSalesTrend(branchId: string, period: Period) {
  const dateFrom = dateFromFor(period)
  return useQuery({
    queryKey: ['dashboard', 'branch-sales-trend', branchId, period] as const,
    queryFn: async () => {
      const res = await getTransactions({ branchId, transactionType: 'sale', dateFrom })
      const sales = (res.data ?? []).filter((t) => t.status !== 'voided')

      const now = Date.now()
      const periodStart = dateFrom
        ? new Date(dateFrom).getTime()
        : sales.reduce((min, t) => Math.min(min, new Date(t.occurredAt).getTime()), now)
      const bucketMs = Math.max(now - periodStart, 1) / TREND_BUCKETS

      const buckets = new Array<number>(TREND_BUCKETS).fill(0)
      for (const t of sales) {
        const idx = Math.min(
          TREND_BUCKETS - 1,
          Math.max(0, Math.floor((new Date(t.occurredAt).getTime() - periodStart) / bucketMs))
        )
        buckets[idx] += Number(t.totalAmount ?? 0)
      }
      return buckets
    },
  })
}

function TrendSparkline({ branchId, period }: { branchId: string; period: Period }) {
  const { data: buckets } = useBranchSalesTrend(branchId, period)
  if (!buckets || buckets.every((v) => v === 0)) return null
  const max = Math.max(...buckets, 1)
  return (
    <div className="flex h-9 items-end gap-1" aria-hidden="true">
      {buckets.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-purple-200"
          style={{ height: `${Math.max((v / max) * 100, v > 0 ? 8 : 3)}%` }}
        />
      ))}
    </div>
  )
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

  const branchId = usePosBranchContext((s) => s.branchId)
  const branchName = usePosBranchContext((s) => s.branchName)
  const { setHeaderExtra } = useWidgetHeader()

  // The widget's own title bar always reads "Sales by Branch" (a static
  // label from the widget registry) — this appends "· <branch>" beside it
  // once a specific branch is selected, so the title still makes sense once
  // the content below stops comparing branches and narrows to just one.
  useEffect(() => {
    setHeaderExtra(
      branchName ? (
        <span className="truncate text-xs font-normal text-zinc-400">· {branchName}</span>
      ) : null
    )
    return () => setHeaderExtra(null)
  }, [branchName, setHeaderExtra])

  const [period, setPeriod] = useState<Period>('all')
  // 'all' (the default) uses the same query key as the KPI strip's Total
  // Revenue tile, so on first load they share one fetch instead of firing
  // two identical requests. Switching to a narrower period is its own key —
  // React Query keeps the previous data on screen while it loads (no
  // setLoading(true) reset), the same anti-flicker pattern used elsewhere on
  // this dashboard.
  const { data: allBranches = [], isLoading: loading } = useDashboardSalesByBranch(
    dateFromFor(period)
  )
  // getSalesByBranch() always returns every branch (it's the endpoint the
  // cross-branch comparison below needs) — narrow to just the selected one
  // here rather than adding a server-side filter nothing else needs.
  const branches = branchId ? allBranches.filter((b) => b.branchId === branchId) : allBranches

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
          <p className="text-xs text-zinc-400">
            {branchName
              ? `No sales at ${branchName} in the selected period.`
              : 'No sales in the selected period.'}
          </p>
          <Link href="/pos" className="text-xs font-medium text-purple-600 hover:underline">
            Open POS →
          </Link>
        </div>
      </div>
    )
  }

  // A single selected branch has nothing to compare bars against — show its
  // own numbers as a plain stat instead of a 100%-width bar that would just
  // be comparing the branch to itself.
  if (branchId) {
    const branch = active[0]!
    return (
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">{periodToggle}</div>
        <div>
          <p className="text-2xl font-bold text-zinc-900">{fmtMoney(branch.totalSales)}</p>
          <p className="text-xs text-zinc-400">
            {branch.transactionCount} transaction{branch.transactionCount === 1 ? '' : 's'}
          </p>
        </div>
        <TrendSparkline branchId={branchId} period={period} />
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
