'use client'

import { useEffect, useState } from 'react'
import { useWidgetSize } from '../WidgetSizeContext'
import { api } from '@/src/libs/api/client'

type SalesOrder = {
  id: string
  totalAmount?: number | string | null
  orderDate?: string
}

type MonthData = { label: string; value: number }

function getRecentMonths(count: number): MonthData[] {
  const months: MonthData[] = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = d.toLocaleDateString('en-PH', { month: 'short' })
    months.push({ label, value: 0 })
  }
  return months
}

export default function SalesTrendWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'
  const barH = isCompact ? 80 : 120
  const monthCount = 7

  const [months, setMonths] = useState<MonthData[]>(getRecentMonths(monthCount))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .get<{ data?: SalesOrder[] }>('/sales/orders', { limit: 500 })
      .then((res) => {
        if (cancelled) return
        const orders = res.data?.data ?? []
        const base = getRecentMonths(monthCount)
        const now = new Date()

        for (const o of orders) {
          if (!o.orderDate) continue
          const d = new Date(o.orderDate)
          const monthsAgo =
            (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
          const idx = monthCount - 1 - monthsAgo
          if (idx >= 0 && idx < monthCount) {
            base[idx].value += Number(o.totalAmount ?? 0)
          }
        }

        setMonths(base)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const maxVal = Math.max(...months.map((m) => m.value), 1)
  const hasData = months.some((m) => m.value > 0)
  const latestValue = months[months.length - 1]?.value ?? 0

  function fmtShort(n: number): string {
    if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `₱${(n / 1_000).toFixed(0)}K`
    return `₱${Math.round(n)}`
  }

  if (loading) {
    return (
      <div className="h-full w-full rounded bg-zinc-100 animate-pulse" style={{ height: barH }} />
    )
  }

  if (!hasData) {
    return (
      <div
        className="flex flex-col items-center justify-center py-4 text-center"
        style={{ height: barH }}
      >
        <p className="text-xs text-zinc-400">No sales trend data yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-1" style={{ height: barH }}>
        {months.map((month, i) => {
          const pct = month.value / maxVal
          const isLatest = i === months.length - 1
          return (
            <div key={month.label} className="group flex flex-1 flex-col items-center gap-1">
              <div
                className="relative w-full flex flex-col justify-end"
                style={{ height: barH - 16 }}
              >
                <div
                  className={`w-full rounded-t-md transition-all ${isLatest ? 'bg-purple-500' : 'bg-purple-200 group-hover:bg-purple-300'}`}
                  style={{ height: `${Math.max(pct * 100, 2)}%` }}
                />
                {isLatest && !isCompact && month.value > 0 && (
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-purple-700">
                    {fmtShort(latestValue)}
                  </span>
                )}
              </div>
              <span className="text-[9px] text-zinc-400">{month.label}</span>
            </div>
          )
        })}
      </div>
      {!isCompact && (
        <div className="flex items-center justify-between border-t border-zinc-100 pt-1">
          <span className="text-xs text-zinc-500">{monthCount}-month trend</span>
          <span className="text-xs font-semibold text-zinc-500">
            {fmtShort(latestValue)} this month
          </span>
        </div>
      )}
    </div>
  )
}
