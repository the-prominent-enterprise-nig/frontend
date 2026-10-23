import { PLEX, MONO } from '@/src/libs/design/plex'
import type { ReturnDisposition } from '@/src/schema/inventory/returns'

/** One place for the surface's chrome, so a panel added later cannot quietly
 *  disagree with the ones already here. Mirrors receive-po/receiveTokens.ts. */
export const PANEL = 'rounded-xl border border-[#e4e4e9] bg-white'

// No width. Three of the five controls using this want a width of their own —
// the quantity box is 74px, the branch select sizes to its longest branch name
// — and a w-full baked in here silently won every one of those, stretching the
// quantity box until "of 200 sold" beside it was clipped to "o".
export const INPUT =
  'h-9 rounded-lg border border-[#d3d3db] bg-white px-2.5 text-[12.5px] text-[#17171c] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]'

export const INPUT_BAD =
  'h-9 rounded-lg border border-[#b42318] bg-[#fdeceb] px-2.5 text-[12.5px] text-[#17171c] outline-none focus:border-[#b42318] focus:shadow-[0_0_0_3px_#fdeceb]'

/** The mono micro-caption over every field and ledger cell. */
export const CAPTION = `${MONO} text-[9.5px] uppercase tracking-[.08em] text-[#5b5b6b]`

export const LABEL = `${MONO} text-[9.5px] uppercase tracking-[.08em] text-[#5b5b6b]`

/**
 * The dot beside each disposition, and nothing else about it.
 *
 * Colour is the only part of a disposition that is presentation — what it
 * means, whether it credits and what it demands next all live in
 * DISPOSITION_META beside the schema that validates them.
 */
export const DISPOSITION_DOT: Record<ReturnDisposition, string> = {
  restock: 'bg-[#0f7b52]',
  quarantine: 'bg-[#d18b1d]',
  repair: 'bg-[#3b74cc]',
  exchange: 'bg-[#7c4fd1]',
  scrap: 'bg-[#b42318]',
}

export const fmtPeso = (n: number): string =>
  `₱${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0
  )}`

export { PLEX, MONO }
