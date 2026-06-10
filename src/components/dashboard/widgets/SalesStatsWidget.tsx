'use client'

import { useEffect, useState } from 'react'
import { ShoppingCart, TrendingUp, Clock, PackageCheck, ArrowUpRight } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'
import { api } from '@/src/libs/api/client'

type SalesOrder = {
  id: string
  totalAmount?: number | string | null
  status?: string
}

type OrdersResponse = {
  data?: SalesOrder[]
  total?: number
}

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `₱${(n / 1_000).toFixed(1)}K`
  return `₱${Math.round(n).toLocaleString()}`
}

type StatEntry = {
  label: string
  value: string
  change: string
  positive: boolean
  icon: typeof ShoppingCart
  iconBg: string
  iconColor: string
}

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

  const [stats, setStats] = useState<StatEntry[]>([
    {
      label: 'Total Sales (MTD)',
      value: '—',
      change: '',
      positive: true,
      icon: ShoppingCart,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
    },
    {
      label: 'Monthly Revenue',
      value: '—',
      change: '',
      positive: true,
      icon: TrendingUp,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Pending Orders',
      value: '—',
      change: '',
      positive: false,
      icon: Clock,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
    },
    {
      label: 'Orders to Deliver',
      value: '—',
      change: '',
      positive: false,
      icon: PackageCheck,
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
    },
  ])

  useEffect(() => {
    let cancelled = false
    api.get<OrdersResponse>('/sales/orders', { limit: 200 }).then((res) => {
      if (cancelled) return
      const orders = res.data?.data ?? []
      const revenue = orders.reduce((sum, o) => sum + Number(o.totalAmount ?? 0), 0)
      const pending = orders.filter((o) => o.status === 'draft').length
      const toDeliver = orders.filter((o) => o.status === 'confirmed').length
      setStats([
        {
          label: 'Total Sales (MTD)',
          value: fmtMoney(revenue),
          change: '',
          positive: true,
          icon: ShoppingCart,
          iconBg: 'bg-green-100',
          iconColor: 'text-green-600',
        },
        {
          label: 'Total Orders',
          value: String(orders.length),
          change: '',
          positive: true,
          icon: TrendingUp,
          iconBg: 'bg-blue-100',
          iconColor: 'text-blue-600',
        },
        {
          label: 'Pending Orders',
          value: String(pending),
          change: '',
          positive: false,
          icon: Clock,
          iconBg: 'bg-amber-100',
          iconColor: 'text-amber-600',
        },
        {
          label: 'Orders to Deliver',
          value: String(toDeliver),
          change: '',
          positive: false,
          icon: PackageCheck,
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
        },
      ])
    })
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
                className={`font-bold text-zinc-900 leading-tight ${isCompact ? 'text-xl' : 'text-2xl'}`}
              >
                {stat.value}
              </p>
              {!isCompact && stat.change && (
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
