'use client'

import {
  X,
  History,
  Package,
  ArrowLeftRight,
  SlidersHorizontal,
  ShoppingCart,
  Undo2,
  Wrench,
  AlertCircle,
  ArrowUpRight,
} from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import { useUIShell } from '@/src/stores/ui-shell.store'
import {
  SERIAL_STATUS_LABELS,
  SERIAL_STATUS_COLORS,
  type SerialHistoryHeader,
  type SerialMovementEntry,
  type SerialMovementType,
} from '@/src/schema/inventory/serial-numbers'
import {
  PLEX,
  MONO,
} from '@/src/app/(app)/(dashboard)/inventory/purchase-orders/_components/procurementTokens'
import { useSerialHistory } from './useSerialHistory'

const TYPE_ICONS: Record<SerialMovementType, typeof Package> = {
  receipt: Package,
  transfer: ArrowLeftRight,
  adjustment: SlidersHorizontal,
  sale: ShoppingCart,
  refund: Undo2,
  credit_memo: Undo2,
  debit_memo: SlidersHorizontal,
  service: Wrench,
  uds: Wrench,
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
  uds: 'bg-[#fdf3e7] text-[#8a4b06]',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

/** "Where is it now", in one line — the question the panel is opened for. */
function whereNow(header: SerialHistoryHeader): string {
  const place = header.consignedToVenue ?? header.location
  if (header.status === 'sold') return place ? `Sold · last held at ${place}` : 'Sold'
  if (header.consignedToVenue) return `Out at ${header.consignedToVenue}`
  return place ? `At ${place}` : 'Location unknown'
}

/** A 404 here means the unit sits outside the caller's branch (the backend
 *  hides out-of-scope records rather than refusing them) or is gone. */
function errorText(error: string): string {
  return /not found/i.test(error)
    ? "This unit isn't visible from your branch, or it no longer exists."
    : `Couldn't load this unit's history. ${error}`
}

function Header({
  header,
  fallbackSerial,
  onClose,
}: {
  header: SerialHistoryHeader | null
  fallbackSerial?: string
  onClose: () => void
}) {
  const { pushPanel } = useUIShell()

  return (
    <div className="shrink-0 border-b border-[#e4e4e9] bg-white px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={`${MONO} text-[11px] font-semibold tracking-[.08em] text-[#8b8b9b] uppercase`}
          >
            Serial history
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className={`${MONO} text-[17px] leading-tight font-semibold text-[#17171c]`}>
              {header?.serialNumber ?? fallbackSerial ?? '—'}
            </h2>
            {header && (
              <span
                className={`inline-flex shrink-0 rounded-[5px] px-2 py-0.5 text-[11.5px] font-medium ${SERIAL_STATUS_COLORS[header.status]}`}
              >
                {SERIAL_STATUS_LABELS[header.status]}
              </span>
            )}
          </div>
          {header && (
            <>
              <p className="mt-1 text-[13px] font-medium text-[#3d3d4a]">{whereNow(header)}</p>
              <button
                type="button"
                onClick={() =>
                  pushPanel({
                    type: 'item360',
                    itemId: header.item.id,
                    itemName: header.item.name,
                    context: 'stock',
                  })
                }
                className="mt-1 inline-flex max-w-full items-center gap-1 text-left text-[12px] text-[#5b21b6] hover:underline"
              >
                <span className="truncate">
                  {header.item.name} · {header.item.sku}
                </span>
                <ArrowUpRight className="h-3 w-3 shrink-0" />
              </button>
            </>
          )}
        </div>
        <Tooltip label="Close" side="bottom" align="end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-[#8b8b9b] hover:bg-[#f1f1f4] hover:text-[#3d3d4a]"
          >
            <X className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}

function TimelineEntry({ entry, isLast }: { entry: SerialMovementEntry; isLast: boolean }) {
  const Icon = TYPE_ICONS[entry.type] ?? Package
  const color = TYPE_COLORS[entry.type] ?? 'bg-[#f1f1f4] text-[#5b5b6b]'

  return (
    <li className="relative flex gap-3 pb-5" data-testid="serial-history-entry">
      {!isLast && (
        <span aria-hidden className="absolute top-8 bottom-0 left-[15px] w-px bg-[#e4e4e9]" />
      )}
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${color}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-[13.5px] font-semibold text-[#17171c]">{entry.label}</p>
          <p className="text-[11.5px] text-[#8b8b9b]">
            {formatDate(entry.occurredAt)} · {formatTime(entry.occurredAt)}
          </p>
        </div>
        <p className="mt-0.5 text-[13px] text-[#5b5b6b]">{entry.description}</p>
        {(entry.referenceCode || entry.invoiceNumber) && (
          <p className={`${MONO} mt-1 text-[11.5px] text-[#8b8b9b]`}>
            {[entry.referenceCode, entry.invoiceNumber && `Invoice ${entry.invoiceNumber}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>
    </li>
  )
}

function Timeline({ entries }: { entries: SerialMovementEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <History className="mb-3 h-10 w-10 text-[#c9c9d3]" />
        <p className="text-[13px] font-medium text-[#5b5b6b]">No movements recorded yet</p>
      </div>
    )
  }
  return (
    <ol className="px-5 pt-5">
      {entries.map((entry, i) => (
        <TimelineEntry key={entry.id} entry={entry} isLast={i === entries.length - 1} />
      ))}
    </ol>
  )
}

function TimelineSkeleton() {
  return (
    <div className="space-y-5 px-5 pt-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-[#eeeef1]" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3.5 w-40 animate-pulse rounded bg-[#eeeef1]" />
            <div className="h-3 w-56 animate-pulse rounded bg-[#f4f4f6]" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** One physical unit: where it is now, then everything that happened to it,
 *  newest first. */
export default function SerialHistoryContent({
  serialId,
  serialNumber,
  onClose,
}: {
  serialId: string
  serialNumber?: string
  onClose: () => void
}) {
  const { header, entries, isLoading, error } = useSerialHistory(serialId)

  return (
    <div className={`${PLEX} flex min-h-0 flex-1 flex-col`}>
      <Header header={header} fallbackSerial={serialNumber} onClose={onClose} />
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <TimelineSkeleton />
        ) : error ? (
          <div className="m-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {errorText(error)}
          </div>
        ) : (
          <Timeline entries={entries} />
        )}
      </div>
    </div>
  )
}
