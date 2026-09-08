/**
 * A supplier's pricing as stated: SRP walked through an ordered chain of
 * discounts, each step feeding the next.
 *
 * One shared formatter because the same chain has to read identically on all
 * four surfaces it appears on — the PO detail, the Receiving Report, the AP
 * bill's on-screen items and the printed Purchase Invoice. Four hand-rolled
 * versions is how "3% then ₱500" ends up rendered as "3% + ₱500" on one screen
 * and "₱590 off" on another, and a reader can no longer tell whether the
 * documents disagree about the terms or just about the wording.
 *
 * Returns '' when the line has no SRP recorded — either it was priced flat, or
 * it predates the pricing fields reaching the server (a zod schema was
 * silently stripping them off the receive payload until 2026-09-07). Callers
 * render their own placeholder for that, rather than this inventing one.
 */

export interface ChainDiscount {
  name?: string | null
  type: string
  value: number
}

export function discountChainLabel(
  line: {
    srp?: number | string | null
    discounts?: ChainDiscount[] | null
    discountedCost?: number | string | null
  },
  fmt: (n: number) => string
): string {
  if (line.srp == null) return ''
  let out = `SRP ${fmt(Number(line.srp))}`
  // Skips entries with no usable value rather than printing them. A DTO
  // transform bug stored a chain of empty arrays before 2026-09-07, and those
  // rows would otherwise render "SRP ₱8,000.00 · NaN off" — a number that
  // looks like a real discount and isn't. Malformed steps are dropped; a
  // chain that is entirely malformed leaves just the SRP.
  const chain = (line.discounts ?? [])
    .filter((d) => d != null && Number.isFinite(Number(d.value)))
    .map((d) => {
      const shown = d.type === 'percentage' ? `${d.value}%` : fmt(Number(d.value))
      return d.name ? `${d.name} (${shown})` : shown
    })
  if (chain.length) {
    out += ` · ${chain.join(' → ')} off`
    if (line.discountedCost != null) out += ` → ${fmt(Number(line.discountedCost))}`
  }
  return out
}
