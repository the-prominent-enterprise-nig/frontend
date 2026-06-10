'use client'

import { AlertTriangle, TrendingDown, Package } from 'lucide-react'
import type { StockBalance } from '@/src/schema/inventory/goods-receiving'

function getStockStatus(balance: StockBalance): 'out' | 'critical' | 'low' | 'healthy' {
  const qty = Number(balance.onHandQty ?? 0)
  const reorder = balance.reorderPoint != null ? Number(balance.reorderPoint) : null
  if (qty <= 0) return 'out'
  if (reorder !== null && qty <= reorder * 0.5) return 'critical'
  if (reorder !== null && qty <= reorder) return 'low'
  return 'healthy'
}

const STATUS_CONFIG = {
  out: { label: 'Out', className: 'bg-red-100 text-red-700', icon: AlertTriangle },
  critical: { label: 'Critical', className: 'bg-red-100 text-red-700', icon: AlertTriangle },
  low: { label: 'Low', className: 'bg-amber-100 text-amber-700', icon: TrendingDown },
  healthy: { label: 'Healthy', className: 'bg-green-100 text-green-700', icon: Package },
}

function StockSkeleton() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-zinc-100" />
      ))}
    </div>
  )
}

type Props = {
  balances: StockBalance[]
  isLoading: boolean
  totalOnHand?: number
  totalAvailable?: number
  totalReserved?: number
}

export default function StockTab({
  balances,
  isLoading,
  totalOnHand,
  totalAvailable,
  totalReserved,
}: Props) {
  if (isLoading) return <StockSkeleton />

  if (balances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Package className="mb-3 h-10 w-10 text-zinc-300" />
        <p className="text-sm font-medium text-zinc-500">No stock on hand</p>
        <p className="mt-1 text-xs text-zinc-400">Receive stock to see balances here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-5">
      {/* Aggregate summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
          {
            label: 'On Hand',
            value: totalOnHand ?? balances.reduce((s, b) => s + Number(b.onHandQty ?? 0), 0),
          },
          {
            label: 'Available',
            value: totalAvailable ?? balances.reduce((s, b) => s + Number(b.availableQty ?? 0), 0),
          },
          {
            label: 'Reserved',
            value: totalReserved ?? balances.reduce((s, b) => s + Number(b.reservedQty ?? 0), 0),
          },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-3 text-center"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              {label}
            </p>
            <p className="mt-0.5 break-all text-base font-bold tabular-nums text-zinc-900 leading-tight">
              {value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Per-warehouse breakdown */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          By Warehouse
        </p>
        <div className="space-y-2">
          {balances.map((balance) => {
            const status = getStockStatus(balance)
            const cfg = STATUS_CONFIG[status]
            const StatusIcon = cfg.icon
            return (
              <div
                key={balance.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {balance.warehouse?.name ?? balance.warehouse?.code ?? '—'}
                  </p>
                  {balance.reorderPoint != null && (
                    <p className="text-xs text-zinc-400">Reorder at {balance.reorderPoint} units</p>
                  )}
                </div>
                <div className="ml-4 flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums text-zinc-900">
                      {Number(balance.onHandQty ?? 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-zinc-400">on hand</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {cfg.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
