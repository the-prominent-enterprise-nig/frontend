'use client'

import { Loader2 } from 'lucide-react'
import type { ReceiptTotals } from './receiveTotals'

type Props = {
  blockerCount: number
  /** Blockers are only shouted about once the receiver has tried to move on. */
  showBlockers: boolean
  totals: ReceiptTotals
  deliveryReceiptNumber: string
  isSubmitting: boolean
  onCancel: () => void
  onPrimary: () => void
}

/** Fixed to the bottom of the working surface: on a long delivery the receive
 * button would otherwise sit below several screens of line items. */
export function ReceiveActionBar({
  blockerCount,
  showBlockers,
  totals,
  deliveryReceiptNumber,
  isSubmitting,
  onCancel,
  onPrimary,
}: Props) {
  const blocked = blockerCount > 0

  // Nothing stands in for a DR number that has not been typed yet — the field
  // itself and the checks card both already say it is required, and a third
  // reminder pinned to the bar read as a scolding.
  const caption = deliveryReceiptNumber.trim()
    ? `Delivery confirmed · ${deliveryReceiptNumber.trim()}`
    : ''

  const headline =
    totals.units > 0
      ? `Receiving ${totals.units} units on ${totals.lines} ${totals.lines === 1 ? 'line' : 'lines'}`
      : 'Enter the quantities delivered'

  return (
    <div className="sticky bottom-0 z-40 flex flex-wrap items-center justify-between gap-3.5 border-t border-[#e4e4e9] bg-white px-4 py-3 shadow-[0_-8px_24px_-16px_rgba(20,20,30,.3)] lg:px-5">
      <div className="flex min-w-0 flex-wrap items-center gap-3.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          {caption && <span className="text-[11.5px] text-[#8b8b9b]">{caption}</span>}
          <span className="text-[13px] font-semibold">{headline}</span>
        </div>
        {blocked && showBlockers && (
          <span className="flex items-center gap-2 rounded-[7px] border border-[#f3c9c5] bg-[#fdeceb] px-2.5 py-1.5 text-[11.5px] text-[#b42318]">
            <span className="inline-block h-[5px] w-[5px] rounded-full bg-[#b42318]" />
            {blockerCount} {blockerCount === 1 ? 'issue blocks' : 'issues block'} posting
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-lg px-3.5 py-2.5 text-[13px] text-[#5b5b6b] hover:bg-[#f1f1f4] hover:text-[#17171c] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onPrimary}
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4.5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#4a189b] disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Receiving…' : 'Receive stock'}
        </button>
      </div>
    </div>
  )
}
