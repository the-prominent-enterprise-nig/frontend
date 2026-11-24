'use client'

import { Loader2 } from 'lucide-react'
import { SearchCombobox } from '@/src/components/ui/SearchCombobox'
import { LABEL, MONO } from './returnTokens'
import { searchReplacementUnits } from './useReplacementUnits'

type Props = {
  /** In-stock units here — the count only; the unit itself is searched. */
  count: number | undefined
  isLoading: boolean
  itemId: string
  warehouseId: string
  /** The unit coming back — it cannot also be the one going out. */
  returnedSerialNumberId?: string
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
  count,
  isLoading,
  itemId,
  warehouseId,
  returnedSerialNumberId,
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
            <span className="flex items-center gap-2 text-[11.5px] text-[#4b4b5a]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Looking for one in stock…
            </span>
          ) : count === 0 ? (
            <p className="text-[11.5px] leading-[1.45] text-[#3d3d4a]">
              Nothing of this item is on the shelf here. Restock or quarantine it instead, and raise
              the replacement as its own sale.
            </p>
          ) : (
            <>
              <SearchCombobox
                value={value ?? ''}
                onChange={(id) => onChange(id || undefined)}
                queryKey={`return-replacement-${itemId}-${warehouseId}`}
                placeholder="Pick a unit from stock…"
                typeToSearchMessage="Type a serial number…"
                emptyMessage="No matching unit in stock here"
                error={missing ? 'Pick the unit going out.' : undefined}
                search={async (query) =>
                  (
                    await searchReplacementUnits(
                      { itemId, warehouseId, returnedSerialNumberId },
                      query
                    )
                  ).map((u) => ({ id: u.id, primary: u.serialNumber }))
                }
              />
              {count !== undefined && (
                <span className={`${MONO} text-[10px] text-ink-muted`}>
                  {count} available here — type a serial number to find one
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={LABEL}>Difference</span>
          <span
            className={`${MONO} text-[14px] font-semibold ${
              serialTracked && !value ? 'text-ink-subtle' : 'text-[#17171c]'
            }`}
          >
            {serialTracked && !value ? '—' : 'Even swap'}
          </span>
          <span className="text-[11px] leading-[1.4] text-[#4b4b5a]">
            {serialTracked && !value
              ? 'Pick the unit going out to settle the swap.'
              : 'Same item at the same price — nothing is credited.'}
          </span>
        </div>
      </div>
    </div>
  )
}
