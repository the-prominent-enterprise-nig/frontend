'use client'

import { useEffect, useState } from 'react'
import { useWidgetSize } from '../WidgetSizeContext'
import { api } from '@/src/libs/api/client'

type SalesOrder = {
  id: string
  orderNumber?: string
  customerName?: string
  totalAmount?: number | string | null
  status?: string
  orderDate?: string
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-blue-100 text-blue-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
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

  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .get<{ data?: SalesOrder[] }>('/sales/orders', { limit: 5 })
      .then((res) => {
        if (cancelled) return
        setOrders(res.data?.data ?? [])
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
            <div className="flex-1 space-y-1">
              <div className="h-2.5 w-24 rounded bg-zinc-100 animate-pulse" />
              <div className="h-2 w-20 rounded bg-zinc-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4 text-center">
        <p className="text-xs text-zinc-400">No orders yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {orders.slice(0, limit).map((order) => {
        const status = order.status ?? 'draft'
        return (
          <div
            key={order.id}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 transition"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-zinc-800">
                {order.orderNumber ?? order.id}
              </p>
              {!isCompact && (
                <p className="truncate text-[10px] text-zinc-500">{order.customerName ?? '—'}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!isCompact && (
                <span className="text-[10px] text-zinc-400">{fmtDate(order.orderDate)}</span>
              )}
              <span
                className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${STATUS_STYLES[status] ?? 'bg-zinc-100 text-zinc-600'}`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
              <span className="text-xs font-semibold text-zinc-700">
                {fmtMoney(order.totalAmount)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
