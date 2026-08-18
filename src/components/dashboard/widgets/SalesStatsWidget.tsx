'use client'

import { useEffect, useState } from 'react'
import { ShoppingCart, Receipt, RotateCcw, TrendingUp, ArrowUpRight } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'
import { getTransactions } from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `₱${(n / 1_000).toFixed(1)}K`
  return `₱${Math.round(n).toLocaleString()}`
}

type StatEntry = {
  label: string
  value: string
  icon: typeof ShoppingCart
  iconBg: string
  iconColor: string
}

const BASE_STATS: StatEntry[] = [
  {
    label: 'Total Sales (MTD)',
    value: '—',
    icon: ShoppingCart,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
  },
  {
    label: 'Transactions (MTD)',
    value: '—',
    icon: Receipt,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    label: 'Refunds (MTD)',
    value: '—',
    icon: RotateCcw,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  {
    label: 'Avg. Transaction',
    value: '—',
    icon: TrendingUp,
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
  },
]

export default function SalesStatsWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs' || variant === 'sm'
  const gridCols =
    variant === 'lg'
      ? 'grid-cols-4'
      : variant === 'md'
        ? 'grid-cols-2'
        : variant === 'sm'
          ? 'grid-cols-2'
          : 'grid-cols-1'

  const [stats, setStats] = useState<StatEntry[]>(BASE_STATS)
  const branchId = usePosBranchContext((s) => s.branchId)

  useEffect(() => {
    let cancelled = false
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    getTransactions({
      dateFrom: monthStart.toISOString(),
      branchId: branchId ?? undefined,
    }).then((res) => {
      if (cancelled) return
      const txns = res.data ?? []
      const sales = txns.filter((t) => t.transactionType === 'sale' && t.status !== 'voided')
      const refunds = txns.filter((t) => t.transactionType === 'refund' && t.status !== 'voided')
      const totalSales = sales.reduce((sum, t) => sum + Number(t.totalAmount ?? 0), 0)
      const avgTxn = sales.length > 0 ? totalSales / sales.length : 0

      setStats([
        { ...BASE_STATS[0]!, value: fmtMoney(totalSales) },
        { ...BASE_STATS[1]!, value: String(sales.length) },
        { ...BASE_STATS[2]!, value: String(refunds.length) },
        { ...BASE_STATS[3]!, value: fmtMoney(avgTxn) },
      ])
    })
    return () => {
      cancelled = true
    }
  }, [branchId])

  return (
    <div className={`grid gap-2 ${gridCols}`}>
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <div
            key={stat.label}
            className="relative flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-xl bg-white p-3 shadow-sm ring-1 ring-zinc-100"
          >
            {!isCompact && (
              <ArrowUpRight
                className="absolute top-2.5 right-2.5 h-3.5 w-3.5 text-zinc-300"
                aria-hidden="true"
              />
            )}
            <div
              className={`flex shrink-0 items-center justify-center rounded-lg ${stat.iconBg} ${isCompact ? 'h-7 w-7' : 'h-9 w-9'}`}
            >
              <Icon
                className={`${isCompact ? 'h-3.5 w-3.5' : 'h-4.5 w-4.5'} ${stat.iconColor}`}
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0">
              <p
                className={`font-medium text-zinc-500 truncate ${isCompact ? 'text-[10px]' : 'text-xs'}`}
              >
                {stat.label}
              </p>
              <p
                className={`font-bold text-zinc-900 leading-tight ${isCompact ? 'text-xl' : 'text-2xl'}`}
              >
                {stat.value}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
