'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Wallet, Receipt, ArrowUpRight } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'
import { Reports } from '@/src/libs/data/AccountingV2Data'

interface Stat {
  label: string
  value: string
  change: string
  positive: boolean
  icon: typeof TrendingUp
  iconBg: string
  iconColor: string
}

const PLACEHOLDER: Stat[] = [
  {
    label: 'Total Revenue',
    value: '—',
    change: 'This month',
    positive: true,
    icon: TrendingUp,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
  {
    label: 'Expenses',
    value: '—',
    change: 'This month',
    positive: false,
    icon: TrendingDown,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
  },
  {
    label: 'Net Profit',
    value: '—',
    change: 'This month',
    positive: true,
    icon: Wallet,
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
  },
  {
    label: 'Outstanding Invoices',
    value: '—',
    change: 'AR balance',
    positive: false,
    icon: Receipt,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
]

function fmtMoneyShort(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `₱${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `₱${(n / 1_000).toFixed(1)}K`
  return `₱${Math.round(n).toLocaleString('en-PH')}`
}

export default function StatsOverviewWidget() {
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

  const [stats, setStats] = useState<Stat[]>(PLACEHOLDER)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const today = now.toISOString().slice(0, 10)
      const [pnl, bi] = await Promise.all([Reports.pnl(monthStart, today), Reports.biSummary()])
      if (cancelled) return
      const revenue = Number(pnl.data?.totalRevenue ?? 0)
      const expenses = Number(pnl.data?.totalOpEx ?? 0) + Number(pnl.data?.totalCogs ?? 0)
      const net = Number(pnl.data?.netIncome ?? revenue - expenses)
      const arOutstanding = Number(bi.data?.arOutstanding ?? 0)

      setStats([
        {
          label: 'Total Revenue',
          value: fmtMoneyShort(revenue),
          change: 'This month',
          positive: revenue >= 0,
          icon: TrendingUp,
          iconBg: 'bg-emerald-100',
          iconColor: 'text-emerald-600',
        },
        {
          label: 'Expenses',
          value: fmtMoneyShort(expenses),
          change: 'This month',
          positive: false,
          icon: TrendingDown,
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
        },
        {
          label: 'Net Profit',
          value: fmtMoneyShort(net),
          change: net >= 0 ? 'Profit' : 'Loss',
          positive: net >= 0,
          icon: Wallet,
          iconBg: 'bg-purple-100',
          iconColor: 'text-purple-600',
        },
        {
          label: 'Outstanding Invoices',
          value: fmtMoneyShort(arOutstanding),
          change: 'AR balance',
          positive: arOutstanding === 0,
          icon: Receipt,
          iconBg: 'bg-amber-100',
          iconColor: 'text-amber-600',
        },
      ])
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
                className={`font-bold text-zinc-900 leading-tight ${variant === 'xs' ? 'text-xl' : isCompact ? 'text-xl' : 'text-2xl'}`}
              >
                {stat.value}
              </p>
              {!isCompact && (
                <p
                  className={`text-xs mt-0.5 ${stat.positive ? 'text-emerald-600' : 'text-red-500'}`}
                >
                  {stat.change}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
