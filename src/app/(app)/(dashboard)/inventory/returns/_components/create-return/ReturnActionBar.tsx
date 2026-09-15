'use client'

import { Loader2 } from 'lucide-react'
import { fmtPeso } from './returnTokens'
import type { ReturnSettlement } from './returnTotals'
import type { ReturnGap } from './returnIssues'

type Props = {
  settlement: ReturnSettlement
  gaps: ReturnGap[]
  hasCustomer: boolean
  isSubmitting: boolean
  onCancel: () => void
}

/**
 * The running state of the return, and the one verb that ends it.
 *
 * It names the first gap rather than a count, because "3 issues" is not
 * something anyone can act on and the checks panel that used to list them all
 * sat above the fold where nobody looked. The button stays enabled while
 * blocked and explains itself when pressed — a disabled button with a reason
 * somewhere else is the same dead end the old screen had.
 */
export default function ReturnActionBar({
  settlement,
  gaps,
  hasCustomer,
  isSubmitting,
  onCancel,
}: Props) {
  const blocked = gaps.length > 0
  const note = !hasCustomer
    ? 'No customer yet'
    : settlement.lines === 0
      ? 'Nothing ticked'
      : blocked
        ? `Needs ${gaps[0].need}`
        : 'Ready to post'

  const headline =
    settlement.lines === 0
      ? 'Customer return'
      : `${settlement.units} ${settlement.units === 1 ? 'unit' : 'units'} · ${
          settlement.net < 0
            ? `${fmtPeso(-settlement.net)} to collect`
            : `${fmtPeso(settlement.net)} back to the customer`
        }`

  return (
    <div className="sticky bottom-0 z-20 flex shrink-0 flex-wrap items-center justify-between gap-3.5 border-t border-[#e4e4e9] bg-white px-[22px] py-3 shadow-[0_-8px_24px_-18px_rgba(20,20,30,.35)]">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          className={`text-[11.5px] ${
            hasCustomer && settlement.lines > 0 && blocked ? 'text-[#b42318]' : 'text-[#5b5b6b]'
          }`}
        >
          {note}
        </span>
        <span className="text-[14px] font-semibold text-[#17171c]">{headline}</span>
      </div>

      <div className="flex flex-wrap items-center gap-[9px]">
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-lg px-[15px] py-[11px] text-[13px] text-[#5b5b6b] hover:bg-[#f1f1f4] hover:text-[#17171c]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className={`flex cursor-pointer items-center gap-2 rounded-lg px-[18px] py-[11px] text-[13.5px] font-semibold text-white ${
            blocked ? 'bg-[#7d5fb8]' : 'bg-[#5b21b6] hover:bg-[#4a189b]'
          } disabled:cursor-wait`}
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Posting…' : 'Post return'}
        </button>
      </div>
    </div>
  )
}
