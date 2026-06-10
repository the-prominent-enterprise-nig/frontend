'use client'

import { Activity } from 'lucide-react'
import type { StockLedgerEntry } from '@/src/schema/inventory/goods-receiving'

const MOVEMENT_CONFIG: Record<string, { label: string; className: string; sign: '+' | '-' | '' }> =
  {
    receive: { label: 'Receive', className: 'bg-green-100 text-green-700', sign: '+' },
    transfer_in: { label: 'Transfer In', className: 'bg-blue-100 text-blue-700', sign: '+' },
    transfer_out: { label: 'Transfer Out', className: 'bg-blue-100 text-blue-600', sign: '-' },
    adjustment: { label: 'Adjustment', className: 'bg-zinc-100 text-zinc-600', sign: '' },
    write_off: { label: 'Write-off', className: 'bg-red-100 text-red-700', sign: '-' },
    return: { label: 'Return', className: 'bg-amber-100 text-amber-700', sign: '+' },
    count_adjust: { label: 'Count Adj.', className: 'bg-zinc-100 text-zinc-600', sign: '' },
  }

function getMovementConfig(type: string) {
  return (
    MOVEMENT_CONFIG[type] ?? {
      label: type,
      className: 'bg-zinc-100 text-zinc-500',
      sign: '' as const,
    }
  )
}

function MovementSkeleton() {
  return (
    <div className="divide-y divide-zinc-100">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
          <div className="h-5 w-20 animate-pulse rounded-full bg-zinc-100" />
          <div className="h-4 flex-1 animate-pulse rounded bg-zinc-100" />
          <div className="h-4 w-10 animate-pulse rounded bg-zinc-100" />
        </div>
      ))}
    </div>
  )
}

type Props = {
  entries: StockLedgerEntry[]
  isLoading: boolean
}

export default function MovementsTab({ entries, isLoading }: Props) {
  if (isLoading) return <MovementSkeleton />

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Activity className="mb-3 h-10 w-10 text-zinc-300" />
        <p className="text-sm font-medium text-zinc-500">No movements yet</p>
        <p className="mt-1 text-xs text-zinc-400">
          Receives, transfers, and adjustments will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-zinc-100">
      {entries.map((entry) => {
        const cfg = getMovementConfig(entry.movementType)
        const qty = entry.quantity
        const signed =
          cfg.sign === '+'
            ? `+${qty}`
            : cfg.sign === '-'
              ? `${qty}`
              : qty > 0
                ? `+${qty}`
                : `${qty}`
        const qtyColor = qty > 0 ? 'text-green-700' : qty < 0 ? 'text-red-600' : 'text-zinc-500'

        return (
          <div key={entry.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-zinc-50">
            {/* Type badge */}
            <span
              className={`mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.className}`}
            >
              {cfg.label}
            </span>

            {/* Detail */}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-zinc-700">
                {entry.warehouse?.name ?? entry.warehouse?.code ?? 'Unknown warehouse'}
              </p>
              {(entry.referenceType || entry.referenceId) && (
                <p className="text-[11px] text-zinc-400">
                  {[entry.referenceType, entry.referenceId].filter(Boolean).join(' ')}
                </p>
              )}
              {entry.notes && <p className="text-[11px] text-zinc-400 italic">{entry.notes}</p>}
            </div>

            {/* Qty + date */}
            <div className="shrink-0 text-right">
              <p className={`text-sm font-bold tabular-nums ${qtyColor}`}>{signed}</p>
              <p className="text-[11px] text-zinc-400">
                {entry.createdAt
                  ? new Date(entry.createdAt).toLocaleDateString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '—'}
              </p>
              {entry.createdBy?.name && (
                <p className="text-[10px] text-zinc-300">{entry.createdBy.name}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
