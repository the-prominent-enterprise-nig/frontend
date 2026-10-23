'use client'

import { UDS_STATUS_LABELS, type UdsStatus } from '@/src/schema/inventory/uds'
import { STATUS_CONFIG, PIPELINE_STATUSES } from './udsDisplay'

type Props = {
  /** Undefined while the count is still in flight — not zero. */
  counts: Partial<Record<UdsStatus, number>>
  selected?: UdsStatus
  onSelect: (value: UdsStatus | undefined) => void
}

/**
 * Where every open sheet currently is, as one band across the top.
 *
 * This replaces an "All Statuses" dropdown, which hid both the shape of the
 * queue and its sizes behind a click — and, worse, gave no hint that the
 * seven options were a sequence rather than seven unrelated labels. The
 * counts come off the server, not off the rows on screen: the list is twenty
 * at a time, so a page could only ever report how many of the current twenty
 * were at the provider, which is not a number anyone wants.
 */
export default function UdsStatusBand({ counts, selected, onSelect }: Props) {
  // Cancelled is not a stage; it earns a tile only when sheets are sitting in
  // it, or when it is the filter currently applied and must stay visible.
  const showCancelled = (counts.cancelled ?? 0) > 0 || selected === 'cancelled'
  const statuses = showCancelled
    ? [...PIPELINE_STATUSES, 'cancelled' as UdsStatus]
    : PIPELINE_STATUSES

  // Separators are the grid's own 1px gaps showing the container background
  // through, rather than per-tile borders: with six or seven tiles reflowing
  // across two, three and seven columns, no fixed border-left/border-top rule
  // survives every wrap.
  return (
    <div
      className={`grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-200 bg-zinc-200 sm:grid-cols-3 ${
        showCancelled ? 'lg:grid-cols-7' : 'lg:grid-cols-6'
      }`}
    >
      {statuses.map((status) => {
        const cfg = STATUS_CONFIG[status]
        const Icon = cfg.icon
        const count = counts[status]
        const isOn = selected === status
        return (
          <button
            key={status}
            type="button"
            aria-pressed={isOn}
            onClick={() => onSelect(isOn ? undefined : status)}
            className={`flex flex-col gap-1 px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-prominent-purple-500 ${
              isOn
                ? 'bg-prominent-purple-50/60 shadow-[inset_0_-2px_0_var(--color-prominent-purple-700)]'
                : 'bg-white hover:bg-zinc-50'
            }`}
          >
            <span className="flex items-center gap-2">
              <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.tone}`} />
              <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {UDS_STATUS_LABELS[status]}
              </span>
            </span>
            {count == null ? (
              <span className="h-7 w-10 animate-pulse rounded bg-zinc-100" />
            ) : (
              <span
                className={`font-mono text-2xl font-semibold tabular-nums ${
                  count === 0 ? 'text-zinc-300' : 'text-zinc-900'
                }`}
              >
                {count}
              </span>
            )}
            <span className="text-xs text-zinc-500">{cfg.note}</span>
          </button>
        )
      })}
    </div>
  )
}
