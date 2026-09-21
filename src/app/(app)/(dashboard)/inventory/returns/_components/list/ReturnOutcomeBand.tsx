'use client'

import type { ReturnOutcome } from '../../_actions/get-returns'
import { OUTCOME_META, OUTCOME_ORDER } from './returnDisplay'

type Props = {
  /** Undefined while the count is still in flight — not zero. */
  counts: Partial<Record<ReturnOutcome, number>>
  selected?: ReturnOutcome
  onSelect: (value: ReturnOutcome | undefined) => void
}

/**
 * The three shapes of record, as one band across the top of the list.
 *
 * This replaces a "All kinds" dropdown, which hid both the split and the
 * sizes of it behind a click. The counts come off the server rather than off
 * the rows on screen — the list is twenty at a time, so a page could only
 * ever report how many of the current twenty were repairs, which is not a
 * number anyone wants.
 */
export default function ReturnOutcomeBand({ counts, selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-gray-200 bg-white sm:grid-cols-3">
      {OUTCOME_ORDER.map((outcome, i) => {
        const meta = OUTCOME_META[outcome]
        const count = counts[outcome]
        const isOn = selected === outcome
        return (
          <button
            key={outcome}
            type="button"
            aria-pressed={isOn}
            onClick={() => onSelect(isOn ? undefined : outcome)}
            className={`flex flex-col gap-1 border-zinc-100 px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-prominent-purple-500 ${
              i > 0 ? 'border-t sm:border-l sm:border-t-0' : ''
            } ${
              isOn
                ? 'bg-prominent-purple-50/60 shadow-[inset_0_-2px_0_var(--color-prominent-purple-700)]'
                : 'hover:bg-zinc-50'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {meta.label}
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
            <span className="text-xs text-zinc-500">{meta.note}</span>
          </button>
        )
      })}
    </div>
  )
}
