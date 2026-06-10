'use client'

import { useEffect, useState } from 'react'
import { Truck, Clock, PackageCheck } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'
import { api } from '@/src/libs/api/client'

type SalesOrder = {
  id: string
  orderNumber?: string
  customerName?: string
  status?: string
  orderDate?: string
  lines?: Array<{ id: string }>
}

const STATUS_STYLES: Record<
  string,
  { bg: string; icon: React.ComponentType<{ className?: string }> }
> = {
  confirmed: { bg: 'bg-blue-100 text-blue-700', icon: PackageCheck },
  processing: { bg: 'bg-amber-100 text-amber-700', icon: Clock },
  draft: { bg: 'bg-zinc-100 text-zinc-600', icon: Truck },
}

function fmtDate(dateStr?: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

export default function PendingDeliveriesWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'
  const limit = isCompact ? 3 : 4

  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .get<{ data?: SalesOrder[] }>('/sales/orders', { status: 'confirmed', limit: 10 })
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
            <div className="h-6 w-6 rounded-full bg-zinc-100 animate-pulse shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-2.5 w-24 rounded bg-zinc-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4 text-center">
        <p className="text-xs text-zinc-400">No pending deliveries</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {orders.slice(0, limit).map((o) => {
        const status = o.status ?? 'confirmed'
        const style = STATUS_STYLES[status] ?? STATUS_STYLES.confirmed
        const Icon = style.icon
        return (
          <div
            key={o.id}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 transition"
          >
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${style.bg}`}
            >
              <Icon className="h-3 w-3" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-900">{o.orderNumber ?? o.id}</p>
              {!isCompact && (
                <p className="truncate text-[10px] text-zinc-500">
                  {o.customerName ?? '—'}
                  {o.lines?.length ? ` · ${o.lines.length} items` : ''}
                </p>
              )}
            </div>
            <p className="text-[10px] text-zinc-400 shrink-0 whitespace-nowrap">
              {fmtDate(o.orderDate)}
            </p>
          </div>
        )
      })}
    </div>
  )
}
