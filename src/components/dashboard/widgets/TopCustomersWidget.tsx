'use client'

import { useEffect, useState } from 'react'
import { useWidgetSize } from '../WidgetSizeContext'
import { api } from '@/src/libs/api/client'

type SalesOrder = {
  id: string
  customerName?: string
  totalAmount?: number | string | null
}

type CustomerRow = {
  name: string
  orders: number
  revenue: number
}

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₱${(n / 1_000).toFixed(0)}K`
  return `₱${Math.round(n).toLocaleString()}`
}

const RANK_BADGE = [
  'bg-amber-100 text-amber-700',
  'bg-zinc-100 text-zinc-600',
  'bg-orange-100 text-orange-600',
  'bg-zinc-50 text-zinc-500',
  'bg-zinc-50 text-zinc-500',
]

export default function TopCustomersWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'
  const limit = isCompact ? 3 : 5

  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .get<{ data?: SalesOrder[] }>('/sales/orders', { limit: 200 })
      .then((res) => {
        if (cancelled) return
        const orders = res.data?.data ?? []
        const map = new Map<string, CustomerRow>()
        for (const o of orders) {
          const name = o.customerName || 'Unknown'
          const existing = map.get(name) ?? { name, orders: 0, revenue: 0 }
          existing.orders += 1
          existing.revenue += Number(o.totalAmount ?? 0)
          map.set(name, existing)
        }
        const sorted = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
        setCustomers(sorted)
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
      <div className="flex flex-col gap-0.5">
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            <div className="h-5 w-5 rounded-full bg-zinc-100 animate-pulse shrink-0" />
            <div className="flex-1 h-3 rounded bg-zinc-100 animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4 text-center">
        <p className="text-xs text-zinc-400">No customer data yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {customers.slice(0, limit).map((c, idx) => (
        <div
          key={c.name}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 transition"
        >
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${RANK_BADGE[idx] ?? RANK_BADGE[4]}`}
          >
            {idx + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-zinc-900">{c.name}</p>
            {!isCompact && (
              <p className="text-[10px] text-zinc-400">
                {c.orders} {c.orders === 1 ? 'order' : 'orders'}
              </p>
            )}
          </div>
          <p className="text-xs font-semibold text-zinc-700 shrink-0">{fmtMoney(c.revenue)}</p>
        </div>
      ))}
    </div>
  )
}
