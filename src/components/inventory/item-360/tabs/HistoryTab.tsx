'use client'

import { History } from 'lucide-react'
import type { ItemChangeLog } from '@/src/schema/inventory/items'

function humanizeField(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim()
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

type Props = {
  entries: ItemChangeLog[]
  isLoading: boolean
}

export default function HistoryTab({ entries, isLoading }: Props) {
  if (isLoading) return <HistorySkeleton />

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <History className="mb-3 h-10 w-10 text-zinc-300" />
        <p className="text-sm font-medium text-zinc-500">No changes recorded yet.</p>
        <p className="mt-1 text-xs text-zinc-400">
          Field-level changes will appear here after edits are saved.
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-zinc-100">
      {entries.map((entry) => {
        const formattedDate = new Date(entry.changedAt).toLocaleString('en-PH', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })

        return (
          <div key={entry.id} className="px-5 py-4 hover:bg-zinc-50">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-500">
                {humanizeField(entry.field)}
              </span>
              <span className="text-[11px] text-zinc-400">{formattedDate}</span>
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
