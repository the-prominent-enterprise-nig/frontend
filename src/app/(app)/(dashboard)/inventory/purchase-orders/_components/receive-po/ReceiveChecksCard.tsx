'use client'

import { MONO } from '../procurementTokens'
import type { Blocker } from './receiveIssues'

type Props = {
  blockers: Blocker[]
  warnings: { key: string; text: string }[]
  /** Takes the receiver to the control a blocker names. */
  onFix: (blocker: Blocker) => void
}

/**
 * One place that answers "can I post this yet, and if not, why".
 *
 * Errors and warnings are kept visually apart on purpose: a missing serial
 * stops the receipt, a short delivery does not, and running them together as
 * one red list taught receivers to ignore both.
 */
export function ReceiveChecksCard({ blockers, warnings, onFix }: Props) {
  const blocked = blockers.length > 0
  const title = blocked
    ? `${blockers.length} ${blockers.length === 1 ? 'issue' : 'issues'} to resolve`
    : warnings.length > 0
      ? `${warnings.length} ${warnings.length === 1 ? 'thing' : 'things'} to note`
      : 'Ready to receive'

  const tone = blocked
    ? { dot: 'bg-[#b42318]', text: 'text-[#b42318]', border: 'border-[#f3c9c5]' }
    : warnings.length > 0
      ? { dot: 'bg-[#b25e09]', text: 'text-[#8a4b06]', border: 'border-[#e4e4e9]' }
      : { dot: 'bg-[#0f7b52]', text: 'text-[#0b6644]', border: 'border-[#e4e4e9]' }

  return (
    <div className={`rounded-xl border bg-white ${tone.border}`}>
      <div className="flex flex-col gap-2.5 px-3.5 py-3">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-[7px] w-[7px] shrink-0 rounded-full ${tone.dot}`} />
          <span className={`text-[12.5px] font-semibold ${tone.text}`}>{title}</span>
        </div>

        {blockers.map((blocker) => (
          <div key={blocker.key} className="flex items-start justify-between gap-2.5 text-[11.5px]">
            <span className="flex items-start gap-[7px] leading-[1.45] text-[#3d3d4a]">
              <span className={`${MONO} pt-px text-[10px] text-[#b42318]`}>!</span>
              {blocker.text}
            </span>
            {blocker.fix && (
              <button
                type="button"
                onClick={() => onFix(blocker)}
                className="shrink-0 text-[11.5px] text-[#5b21b6] underline hover:text-[#4a189b]"
              >
                Fix
              </button>
            )}
          </div>
        ))}

        {!blocked && (
          <div className="flex items-start gap-[7px] text-[11.5px] leading-[1.45] text-[#3d3d4a]">
            <span className={`${MONO} pt-px text-[10px] text-[#0f7b52]`}>✓</span>
            Delivery details, quantities and serials are complete.
          </div>
        )}

        {warnings.map((warning) => (
          <div
            key={warning.key}
            className="flex items-start gap-[7px] text-[11.5px] leading-[1.45] text-[#3d3d4a]"
          >
            <span className={`${MONO} pt-px text-[10px] text-[#b25e09]`}>~</span>
            {warning.text}
          </div>
        ))}
      </div>
    </div>
  )
}
