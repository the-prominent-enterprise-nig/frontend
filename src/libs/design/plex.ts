// The shared design language for the screens that follow the #5b21b6 palette —
// procurement, price lists, returns and their siblings.
//
// Typography is the app-wide Poppins brand font, same as every other screen:
// PLEX and MONO resolve to the `--font-sans` / `--font-mono` theme tokens in
// globals.css, both of which point at Poppins. They stay as named constants so
// the screens that already bind to them keep one place to change if the
// typography ever diverges again.
export const PLEX = 'font-sans'
export const MONO = 'font-mono'

/** The border treatment shared by every control in these screens' toolbars —
 * search boxes, type-ahead pickers, sort selects — so the whole row reads as
 * one set of inputs. */
export const CONTROL_CHROME = {
  idle: 'border-[#d3d3db]',
  focused: 'border-[#5b21b6] shadow-[0_0_0_3px_#f0e9fc]',
}

/** Column-heading typography for the Stock Transactions tables — Stock
 * Transfer's heading, 2px larger, applied to every tab so the hub reads as one
 * set of tables. Typography only: each table keeps its own cell padding, which
 * is what lines a heading up with the column under it. */
export const STOCK_TABLE_HEAD =
  'font-mono text-[12px] font-semibold uppercase tracking-[0.09em] text-[#5b5b6b]'
