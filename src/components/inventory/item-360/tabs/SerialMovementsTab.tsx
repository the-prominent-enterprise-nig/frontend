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
import {
  PLEX,
  MONO,
} from '@/src/app/(app)/(dashboard)/inventory/purchase-orders/_components/procurementTokens'

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
  receipt: 'bg-[#e7f5ef] text-[#0b6644]',
  transfer: 'bg-[#e3f4f2] text-[#0f7566]',
  adjustment: 'bg-[#f1ebfb] text-[#3f1490]',
  sale: 'bg-[#eaf0fb] text-[#1f4b99]',
  refund: 'bg-[#fdf0e5] text-[#b25e09]',
  credit_memo: 'bg-[#fdf0e5] text-[#b25e09]',
  debit_memo: 'bg-[#fdf3e7] text-[#8a4b06]',
  service: 'bg-[#eeecfb] text-[#4c3fa6]',
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
    <div className="divide-y divide-[#f4f4f6]">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="px-5 py-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="h-3.5 w-24 animate-pulse rounded bg-[#f4f4f6]" />
            <div className="h-3.5 w-32 animate-pulse rounded bg-[#f4f4f6]" />
          </div>
          <div className="h-4 w-56 animate-pulse rounded bg-[#f4f4f6]" />
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
    <div className={PLEX}>
      <div className="flex items-center gap-2 border-b border-[#f1f1f4] px-5 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-[#8b8b9b] hover:bg-[#f1f1f4] hover:text-[#3d3d4a]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Stock
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <p className={`${MONO} text-[13px] font-semibold text-[#17171c]`}>
            {serial.serialNumber}
          </p>
          <p className="mt-0.5 text-[12px] text-[#5b5b6b]">
            {(serial.warehouse ?? serial.currentWarehouse)?.branch?.name ??
              (serial.warehouse ?? serial.currentWarehouse)?.name ??
              'Unknown location'}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-[5px] px-2 py-0.5 text-[11.5px] font-medium ${SERIAL_STATUS_COLORS[serial.status]}`}
        >
          {SERIAL_STATUS_LABELS[serial.status]}
        </span>
      </div>

      {isLoading ? (
        <MovementsSkeleton />
      ) : movements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <History className="mb-3 h-10 w-10 text-[#c9c9d3]" />
          <p className="text-[13px] font-medium text-[#5b5b6b]">No movements recorded yet</p>
          <p className="mt-1 text-[12px] text-[#8b8b9b]">
            Receipts, transfers, sales, and other events for this unit will appear here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#f4f4f6]">
          {movements.map((entry) => {
            const Icon = TYPE_ICONS[entry.type] ?? Package
            const colorClass = TYPE_COLORS[entry.type] ?? 'bg-[#f1f1f4] text-[#5b5b6b]'

            return (
              <div key={entry.id} className="px-5 py-4 hover:bg-[#fcfcfd]">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${colorClass}`}
                  >
                    <Icon className="h-3 w-3" />
                    {entry.label}
                  </span>
                  <span className="text-[11px] text-[#a3a3b2]">
                    {formatDateTime(entry.occurredAt)}
                  </span>
                </div>
                <p className="text-[13px] text-[#3d3d4a]">{entry.description}</p>
                {entry.referenceCode && (
                  <p className={`${MONO} mt-0.5 text-[11px] text-[#a3a3b2]`}>
                    {entry.referenceCode}
                  </p>
                )}
                {entry.invoiceNumber && (
                  <p className={`${MONO} mt-0.5 text-[11px] text-[#a3a3b2]`}>
                    Invoice: {entry.invoiceNumber}
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
