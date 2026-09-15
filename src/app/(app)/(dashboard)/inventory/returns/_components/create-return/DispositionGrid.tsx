'use client'

import Tooltip from '@/src/components/ui/Tooltip'
import {
  DISPOSITION_META,
  DISPOSITION_ORDER,
  type ReturnDisposition,
} from '@/src/schema/inventory/returns'
import { DISPOSITION_DOT } from './returnTokens'

type Props = {
  value: ReturnDisposition | ''
  onChange: (value: ReturnDisposition) => void
  /** No unit of this item is on the shelf here, so there is nothing to swap
   *  it for. The option stays visible and says why rather than disappearing —
   *  a button that is sometimes missing is harder to trust than one that is
   *  greyed out with a reason. */
  exchangeUnavailable: boolean
  /** True once the clerk has tried to post, so an unanswered question can go
   *  red without nagging anyone who has only just ticked the row. */
  showError: boolean
}

/**
 * The one question, as five buttons side by side.
 *
 * All five are on screen at once because they are alternatives to each other:
 * a select would hide four of them behind a click and make "scrap" and
 * "restock" look equally routine. The consequence rides under each label for
 * the same reason — the clerk choosing "quarantine" needs to know it means the
 * unit is not sellable, at the moment of choosing.
 */
export default function DispositionGrid({
  value,
  onChange,
  exchangeUnavailable,
  showError,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
      {DISPOSITION_ORDER.map((key) => {
        const meta = DISPOSITION_META[key]
        const selected = value === key
        const off = key === 'exchange' && exchangeUnavailable

        const button = (
          <button
            key={key}
            type="button"
            disabled={off}
            aria-pressed={selected}
            onClick={() => onChange(key)}
            className={`flex min-w-0 cursor-pointer items-center gap-[7px] rounded-[9px] border px-[9px] py-2 text-left disabled:cursor-not-allowed ${
              selected
                ? 'border-[#5b21b6] bg-[#faf7ff] shadow-[0_0_0_3px_#f0e9fc]'
                : showError && !value
                  ? 'border-[#f3c9c5] bg-white'
                  : 'border-[#e4e4e9] bg-white hover:border-[#c9b6ec]'
            }`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                off ? 'bg-[#d3d3db]' : DISPOSITION_DOT[key]
              }`}
            />
            <span className="flex min-w-0 flex-col gap-px">
              <span
                className={`truncate text-[12px] ${selected ? 'font-semibold' : 'font-medium'} ${
                  off ? 'text-[#a3a3b2]' : 'text-[#17171c]'
                }`}
              >
                {meta.label}
              </span>
              <span
                className={`text-[10px] leading-[1.3] ${
                  off ? 'text-[#a3a3b2]' : selected ? 'text-[#3d3d4a]' : 'text-[#5b5b6b]'
                }`}
              >
                {off ? 'none in stock' : meta.note}
              </span>
            </span>
          </button>
        )

        return off ? (
          <Tooltip key={key} label="No replacement unit in this branch" side="top">
            {/* Wrapped, not applied to the button: a disabled button fires no
                pointer events, so the tooltip would never open on the one
                option that actually needs explaining. */}
            <span className="flex min-w-0">{button}</span>
          </Tooltip>
        ) : (
          button
        )
      })}
    </div>
  )
}
