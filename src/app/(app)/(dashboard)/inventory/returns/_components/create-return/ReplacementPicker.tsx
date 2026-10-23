'use client'

import { Loader2 } from 'lucide-react'
import { INPUT, INPUT_BAD, LABEL, MONO } from './returnTokens'
import type { ReplacementUnit } from './useReplacementUnits'

type Props = {
  units: ReplacementUnit[]
  isLoading: boolean
  /** False for an item that is not serial-tracked: the swap is by quantity and
   *  there is no named unit to choose. */
  serialTracked: boolean
  value?: string
  onChange: (serialNumberId: string | undefined) => void
  showError: boolean
}

/**
 * The unit handed over in place of the one coming back, and what the swap
 * settles to.
 *
 * Picked from stock rather than typed, unlike the serial capture on the
 * receiving side: a replacement is a unit the branch already holds, so the
 * only honest options are the ones actually on the shelf here. Anything typed
 * freehand would be a promise the stock check is about to refuse.
 *
 * The Difference reads "Even swap" and nothing else, because that is the only
 * exchange this system posts — same item, same price, nothing credited. The
 * cell is here rather than omitted so the money is stated at the point of the
 * decision instead of being something the clerk has to know.
 */
export default function ReplacementPicker({
  units,
  isLoading,
  serialTracked,
  value,
  onChange,
  showError,
}: Props) {
  const missing = showError && serialTracked && !value

  return (
    <div className="rounded-[10px] border border-[#ddd0f7] bg-[#faf7ff] px-[15px] py-[13px]">
      <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:gap-x-4">
        <div className="flex min-w-0 flex-col gap-[5px]">
          <label className={LABEL}>
            Replacement unit {serialTracked && <span className="text-[#b42318]">*</span>}
          </label>

          {!serialTracked ? (
            <p className="text-[11.5px] leading-[1.45] text-[#3d3d4a]">
              This item is not serial-tracked, so the swap is counted rather than named — one unit
              leaves stock here.
            </p>
          ) : isLoading ? (
            <span className="flex items-center gap-2 text-[11.5px] text-[#5b5b6b]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Looking for one in stock…
            </span>
          ) : units.length === 0 ? (
            <p className="text-[11.5px] leading-[1.45] text-[#3d3d4a]">
              Nothing of this item is on the shelf here. Restock or quarantine it instead, and raise
              the replacement as its own sale.
            </p>
          ) : (
            <>
              <select
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value || undefined)}
                aria-label="Replacement unit"
                className={`w-full cursor-pointer ${missing ? INPUT_BAD : INPUT}`}
              >
                <option value="">Pick a unit from stock…</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.serialNumber}
                  </option>
                ))}
              </select>
              <span className={`${MONO} text-[10px] text-[#8b8b9b]`}>
                {units.length} available here
              </span>
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={LABEL}>Difference</span>
          <span
            className={`${MONO} text-[14px] font-semibold ${
              serialTracked && !value ? 'text-[#a3a3b2]' : 'text-[#17171c]'
            }`}
          >
            {serialTracked && !value ? '—' : 'Even swap'}
          </span>
          <span className="text-[11px] leading-[1.4] text-[#5b5b6b]">
            {serialTracked && !value
              ? 'Pick the unit going out to settle the swap.'
              : 'Same item at the same price — nothing is credited.'}
          </span>
        </div>
      </div>
    </div>
  )
}
