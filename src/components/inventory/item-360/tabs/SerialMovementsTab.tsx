'use client'

import {
  ChevronLeft,
  History,
  Package,
  ArrowLeftRight,
  SlidersHorizontal,
  ShoppingCart,
  Undo2,
  Wrench,
} from 'lucide-react'
import type { SerialNumberSummary, SerialMovementType } from '@/src/schema/inventory/serial-numbers'
import { SERIAL_STATUS_LABELS, SERIAL_STATUS_COLORS } from '@/src/schema/inventory/serial-numbers'
import { useSerialMovements } from '../hooks/useSerialMovements'

const TYPE_ICONS: Record<SerialMovementType, typeof Package> = {
  receipt: Package,
  transfer: ArrowLeftRight,
  adjustment: SlidersHorizontal,
  sale: ShoppingCart,
  refund: Undo2,
  credit_memo: Undo2,
  debit_memo: SlidersHorizontal,
  service: Wrench,
}

const TYPE_COLORS: Record<SerialMovementType, string> = {
  receipt: 'bg-green-100 text-green-700',
  transfer: 'bg-teal-100 text-teal-700',
  adjustment: 'bg-purple-100 text-purple-700',
  sale: 'bg-blue-100 text-blue-700',
  refund: 'bg-orange-100 text-orange-700',
  credit_memo: 'bg-orange-100 text-orange-700',
  debit_memo: 'bg-amber-100 text-amber-700',
  service: 'bg-indigo-100 text-indigo-700',
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function MovementsSkeleton() {
  return (
    <div className="divide-y divide-zinc-100">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="px-5 py-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="h-3.5 w-24 animate-pulse rounded bg-zinc-100" />
            <div className="h-3.5 w-32 animate-pulse rounded bg-zinc-100" />
          </div>
          <div className="h-4 w-56 animate-pulse rounded bg-zinc-100" />
        </div>
      ))}
    </div>
  )
}

export default function SerialMovementsTab({
  serial,
  onBack,
}: {
  serial: SerialNumberSummary
  onBack: () => void
}) {
  const { movements, isLoading } = useSerialMovements(serial.id)

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Serials
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-zinc-800">{serial.serialNumber}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {(serial.warehouse ?? serial.currentWarehouse)?.branch?.name ??
              (serial.warehouse ?? serial.currentWarehouse)?.name ??
              'Unknown location'}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${SERIAL_STATUS_COLORS[serial.status]}`}
        >
          {SERIAL_STATUS_LABELS[serial.status]}
        </span>
      </div>

      {isLoading ? (
        <MovementsSkeleton />
      ) : movements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <History className="mb-3 h-10 w-10 text-zinc-300" />
          <p className="text-sm font-medium text-zinc-500">No movements recorded yet</p>
          <p className="mt-1 text-xs text-zinc-400">
            Receipts, transfers, sales, and other events for this unit will appear here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {movements.map((entry) => {
            const Icon = TYPE_ICONS[entry.type] ?? Package
            const colorClass = TYPE_COLORS[entry.type] ?? 'bg-zinc-100 text-zinc-600'

            return (
              <div key={entry.id} className="px-5 py-4 hover:bg-zinc-50">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${colorClass}`}
                  >
                    <Icon className="h-3 w-3" />
                    {entry.label}
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {formatDateTime(entry.occurredAt)}
                  </span>
                </div>
                <p className="text-sm text-zinc-700">{entry.description}</p>
                {entry.referenceCode && (
                  <p className="mt-0.5 font-mono text-[11px] text-zinc-400">
                    {entry.referenceCode}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
