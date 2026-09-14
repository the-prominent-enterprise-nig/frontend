// The IBM Plex + #5b21b6 design language, shared by the screens whose designs
// call for it — procurement and price lists — rather than the app-wide
// Poppins brand tokens. The two font CSS variables are registered by
// next/font in app/layout.tsx.
//
// These live here, not in one feature's token file, because two features now
// bind to them: a second hand-written copy of the font-family syntax is how
// the screens quietly drift onto different fonts.
//
// Do NOT write Tailwind's square-bracket arbitrary-value syntax for binding
// font-family anywhere else in this repo unless it names a real, complete
// variable as these two do — Tailwind v4 scans plain text for class
// candidates, so a partial version compiles into invalid CSS and 500s every
// page in the app.
export const PLEX = 'font-[family-name:var(--font-plex-sans)]'
export const MONO = 'font-[family-name:var(--font-plex-mono)]'

/** The border treatment shared by every control in these screens' toolbars —
 * search boxes, type-ahead pickers, sort selects — so the whole row reads as
 * one set of inputs. */
export const CONTROL_CHROME = {
  idle: 'border-[#d3d3db]',
  focused: 'border-[#5b21b6] shadow-[0_0_0_3px_#f0e9fc]',
}
