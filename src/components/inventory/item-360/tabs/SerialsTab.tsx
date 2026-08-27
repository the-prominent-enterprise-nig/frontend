'use client'

import { Hash } from 'lucide-react'
import {
  SERIAL_STATUS_LABELS,
  SERIAL_STATUS_COLORS,
  type SerialNumberSummary,
} from '@/src/schema/inventory/serial-numbers'
import { formatShortDate, formatAge } from '@/src/libs/format/date'
import { originLabel } from '@/src/libs/format/serial-provenance'
import { displayClassificationLabel } from '@/src/libs/format/text'

function SerialsSkeleton() {
  return (
    <div className="space-y-2 p-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100" />
      ))}
    </div>
  )
}

export default function SerialsTab({
  serials,
  isLoading,
  onSelectSerial,
}: {
  serials: SerialNumberSummary[]
  isLoading: boolean
  onSelectSerial: (serial: SerialNumberSummary) => void
}) {
  if (isLoading) return <SerialsSkeleton />

  if (serials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Hash className="mb-3 h-10 w-10 text-zinc-300" />
        <p className="text-sm font-medium text-zinc-500">No serial numbers yet</p>
        <p className="mt-1 text-xs text-zinc-400">
          Register or receive stock to see individual units here.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto p-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200">
            <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Serial #
            </th>
            <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Location
            </th>
            <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Type
            </th>
            <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Status
            </th>
            <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              RR #
            </th>
            <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Origin
            </th>
            <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Date In
            </th>
            <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Age
            </th>
            <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Unit Cost
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {serials.map((serial) => (
            <tr
              key={serial.id}
              className="cursor-pointer hover:bg-zinc-50"
              onClick={() => onSelectSerial(serial)}
            >
              <td className="px-2 py-2 font-mono text-xs font-semibold text-zinc-700">
                {serial.serialNumber}
              </td>
              <td className="px-2 py-2 text-zinc-600">
                {(serial.warehouse ?? serial.currentWarehouse)?.branch?.name ??
                  (serial.warehouse ?? serial.currentWarehouse)?.name ??
                  '—'}
              </td>
              <td className="px-2 py-2 text-zinc-600">
                {displayClassificationLabel(serial.item?.type?.name) ?? '—'}
              </td>
              <td className="px-2 py-2 text-center">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${SERIAL_STATUS_COLORS[serial.status]}`}
                >
                  {SERIAL_STATUS_LABELS[serial.status]}
                </span>
              </td>
              <td className="px-2 py-2 font-mono text-xs text-zinc-600">
                {serial.goodsReceiptLine?.goodsReceipt?.code ?? '—'}
              </td>
              <td className="px-2 py-2 text-zinc-600">{originLabel(serial)}</td>
              <td className="px-2 py-2 text-zinc-500">
                {serial.goodsReceiptLine?.goodsReceipt?.receivedAt
                  ? formatShortDate(serial.goodsReceiptLine.goodsReceipt.receivedAt)
                  : '—'}
              </td>
              <td className="px-2 py-2 text-zinc-500">
                {serial.goodsReceiptLine?.goodsReceipt?.receivedAt
                  ? formatAge(serial.goodsReceiptLine.goodsReceipt.receivedAt)
                  : '—'}
              </td>
              <td className="px-2 py-2 text-right text-zinc-700">
                {serial.goodsReceiptLine?.unitCost != null
                  ? `₱${Number(serial.goodsReceiptLine.unitCost).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
