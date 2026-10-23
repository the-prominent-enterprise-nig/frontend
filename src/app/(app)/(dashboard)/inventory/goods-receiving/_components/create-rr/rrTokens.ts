// The Create Receiving Report screen follows the same #5b21b6
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
 * Scenario 55 (Stock-side Manual RR parity, follow-up) — matches
 * ManualRrForm.tsx's own header grid column-for-column now (Item/SKU, Qty,
 * SRP, Discounts, Unit Price, Line Total, Free): serial capture moved from
 * its own column + toggle button to always-visible inline inputs below the
 * row (same as Manual RR's own serial inputs), so there's no longer a
 * Serials column to carry. The actions column is wider than Manual RR's own
 * 60px — duplicate + QC hold + remove is 3 icons where Manual RR only ever
 * needs 2 (duplicate + remove), since quality hold has no Manual RR
 * equivalent.
 *
 * The grid-cols utility itself carries the `lg:` prefix (mirrors
 * ManualRrLineRow.tsx's own `xl:grid-cols-[...]`) rather than living on a
 * separate `hidden lg:grid` wrapper: the header row stays exactly that
 * (`hidden ... lg:grid`, where the prefix is redundant but harmless — the
 * element doesn't exist below lg regardless), but a line row needs a real
 * mobile layout of its own (`grid grid-cols-1` by default, stacked), not to
 * vanish below lg. */
export const RR_LINE_GRID =
  'lg:grid-cols-[minmax(0,1fr)_64px_100px_120px_112px_96px_44px_92px] items-start gap-x-2.5'

/** Section caption above a grouped block of fields. */
export const GROUP_LABEL = 'text-[12px] font-medium text-[#3d3d4a]'
