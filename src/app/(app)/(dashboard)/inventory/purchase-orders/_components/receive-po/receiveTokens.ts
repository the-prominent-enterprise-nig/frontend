// The receive screen follows the Purchase Orders / Create Purchase Order
// design's own #5b21b6 palette — see ../procurementTokens.ts. Only the strings repeated
// across more than one of these files live here; one-off colours stay as
// inline Tailwind arbitrary values at their call site.

export const PANEL = 'rounded-xl border border-[#e4e4e9] bg-white'

export const INPUT =
  'h-[38px] w-full rounded-lg border border-[#d3d3db] bg-white px-3 text-[13px] text-[#17171c] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]'

export const INPUT_BAD =
  'h-[38px] w-full rounded-lg border border-[#b42318] bg-[#fdeceb] px-3 text-[13px] text-[#17171c] outline-none focus:border-[#b42318]'

/** Small uppercase mono caption used above every grouped block. */
export const CAPTION = 'text-[10px] uppercase tracking-[.09em] text-[#a3a3b2]'

/** The line-items grid, shared by the header row and every wide line so the
 * columns actually line up.
 *
 * Deliberately carries no `display` utility: both call sites are
 * `hidden lg:grid`, and pairing a bare `grid` with `hidden` leaves two
 * conflicting display rules in the same Tailwind layer, where which one wins
 * is decided by stylesheet order rather than by anything at the call site. */
export const LINE_GRID =
  'grid-cols-[28px_minmax(150px,1fr)_58px_116px_86px_112px_128px_40px_104px] items-center gap-x-2.5'
