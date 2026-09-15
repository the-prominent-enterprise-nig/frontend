// The Create Receiving Report screen follows the same IBM Plex + #5b21b6
// language as its sibling receive screen (Receive against PO) and the
// Receiving Reports list it is launched from — see
// ../../purchase-orders/_components/receive-po/receiveTokens.ts, whose PANEL /
// INPUT / INPUT_BAD are imported directly rather than copied so the two
// receiving surfaces cannot drift apart.
//
// Only what is genuinely repeated across more than one file here lives in this
// module; one-off colours stay as inline Tailwind arbitrary values at the call
// site they belong to.

export {
  PANEL,
  INPUT,
  INPUT_BAD,
  CAPTION,
} from '../../../purchase-orders/_components/receive-po/receiveTokens'

/** The line-items grid, shared by the header row and every wide line so the
 * columns actually line up.
 *
 * Carries no `display` utility on purpose: both call sites are
 * `hidden lg:grid`, and pairing a bare `grid` with `hidden` leaves two
 * conflicting display rules in the same Tailwind layer. */
export const RR_LINE_GRID =
  'grid-cols-[minmax(170px,1fr)_124px_minmax(120px,148px)_100px_112px_36px] items-start gap-x-2.5'

/** Section caption above a grouped block of fields. */
export const GROUP_LABEL = 'text-[12px] font-medium text-[#3d3d4a]'
