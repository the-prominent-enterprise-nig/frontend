'use client'

import { History, Package, ArrowLeftRight } from 'lucide-react'
import type { ItemChangeLog } from '@/src/schema/inventory/items'
import type { ItemLedgerEntry } from '@/src/schema/inventory/items/ledger'

function humanizeField(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim()
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

function HistorySkeleton() {
  return (
    <div className="divide-y divide-zinc-100">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="px-5 py-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="h-3.5 w-24 animate-pulse rounded bg-zinc-100" />
            <div className="h-3.5 w-20 animate-pulse rounded bg-zinc-100" />
          </div>
          <div className="h-4 w-48 animate-pulse rounded bg-zinc-100" />
          <div className="mt-1.5 h-3 w-32 animate-pulse rounded bg-zinc-100" />
        </div>
      ))}
    </div>
  )
}

const PROVENANCE_LABELS: Record<string, string> = {
  receipt: 'Received',
  transfer_in: 'Transferred in',
  transfer_out: 'Transferred out',
}

const PROVENANCE_COLORS: Record<string, string> = {
  receipt: 'bg-green-100 text-green-700',
  transfer_in: 'bg-teal-100 text-teal-700',
  transfer_out: 'bg-amber-100 text-amber-700',
}

type TimelineEntry =
  | { kind: 'provenance'; timestamp: string; entry: ItemLedgerEntry }
  | { kind: 'change'; timestamp: string; entry: ItemChangeLog }

type Props = {
  changeEntries: ItemChangeLog[]
  provenanceEntries: ItemLedgerEntry[]
  isLoading: boolean
}

export default function HistoryTab({ changeEntries, provenanceEntries, isLoading }: Props) {
  if (isLoading) return <HistorySkeleton />

  const timeline: TimelineEntry[] = [
    ...provenanceEntries.map(
      (entry): TimelineEntry => ({ kind: 'provenance', timestamp: entry.occurredAt, entry })
    ),
    ...changeEntries.map(
      (entry): TimelineEntry => ({ kind: 'change', timestamp: entry.changedAt, entry })
    ),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  if (timeline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <History className="mb-3 h-10 w-10 text-zinc-300" />
        <p className="text-sm font-medium text-zinc-500">No history recorded yet.</p>
        <p className="mt-1 text-xs text-zinc-400">
          Stock receipts, transfers, and field changes will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-zinc-100">
      {timeline.map((item) => {
        if (item.kind === 'provenance') {
          const entry = item.entry
          const Icon = entry.transactionType === 'receipt' ? Package : ArrowLeftRight
          const label = PROVENANCE_LABELS[entry.transactionType] ?? entry.transactionType
          const colorClass = PROVENANCE_COLORS[entry.transactionType] ?? 'bg-zinc-100 text-zinc-600'
          const qty = entry.quantityIn > 0 ? entry.quantityIn : entry.quantityOut
          const preposition = entry.transactionType === 'transfer_out' ? 'out of' : 'at'

          return (
            <div key={`p-${entry.id}`} className="px-5 py-4 hover:bg-zinc-50">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${colorClass}`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </span>
                <span className="text-[11px] text-zinc-400">
                  {formatDateTime(entry.occurredAt)}
                </span>
              </div>
              <p className="text-sm text-zinc-700">
                <span className="font-medium">
                  {qty} unit{qty === 1 ? '' : 's'}
                </span>{' '}
                {preposition} {entry.warehouse?.name ?? 'Unknown warehouse'}
              </p>
              {(entry.referenceCode || entry.notes) && (
                <p className="mt-0.5 text-[11px] text-zinc-400">
                  {entry.referenceCode && <span className="font-mono">{entry.referenceCode}</span>}
                  {entry.referenceCode && entry.notes && ' · '}
                  {entry.notes}
                </p>
              )}
            </div>
          )
        }

        const entry = item.entry
        return (
          <div key={`c-${entry.id}`} className="px-5 py-4 hover:bg-zinc-50">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-500">
                {humanizeField(entry.field)}
              </span>
              <span className="text-[11px] text-zinc-400">{formatDateTime(entry.changedAt)}</span>
            </div>
            <p className="text-sm text-zinc-700">
              <span className="line-through text-zinc-400">{entry.oldValue ?? '—'}</span>
              <span className="mx-2 text-zinc-300">→</span>
              <span className="font-medium">{entry.newValue ?? '—'}</span>
            </p>
            {entry.changedBy && (
              <p className="mt-0.5 text-[11px] text-zinc-400">by {entry.changedBy}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
