// One down payment for several items.
//
// The server already treats the installment lines of a sale as groups: in-house
// lines on the same financing term become ONE schedule with ONE down payment
// (the sum of their lines'), and every TPF line is collected as ONE down
// payment. The till used to ask for it item by item, so a customer saying
// "₱5,000 down for the lot" had to be split by hand. This is that split: a
// single figure for the group, shared out across its items by sale amount.

/** A cart row's share of a group. A serialized item's units share one row. */
export interface DpRow {
  /** Ids of the cart lines in the row (one per unit). */
  lineIds: string[]
  /** The row's sale amount, tax included — what its share is weighed by. */
  amount: number
  /** The rate card's down payment PER LINE when it fixes this row's — the row
   * then takes exactly that and is not part of what the cashier splits. Null
   * for a row whose down payment is open. */
  fixedPerLine: number | null
}

export type DpSplit =
  | {
      ok: true
      /** The new down payment for every line of an OPEN row. Rate-card rows
       * are not listed: their figure is fixed and kept by the checkout. */
      byLine: Map<string, number>
    }
  | {
      ok: false
      /** too_small: nothing (or less than a centavo a line) is left for the
       * open rows once the rate card's rows are covered. too_large: more than
       * the group's items cost. */
      reason: 'too_small' | 'too_large'
    }

const cents = (n: number) => Math.round(n * 100) / 100
const MIN_PER_LINE = 0.01

/** What the rate card's rows contribute to a group's down payment. */
export function fixedDownPaymentTotal(rows: DpRow[]): number {
  return cents(
    rows.reduce(
      (sum, r) => sum + (r.fixedPerLine == null ? 0 : r.fixedPerLine * r.lineIds.length),
      0
    )
  )
}

/**
 * Shares one total down payment across a group's open rows, by sale amount.
 *
 * - Rate-card rows keep their fixed figure; the total is what the group pays
 *   altogether, so the open rows get the total less those.
 * - Each row's share is to the centavo and the last open row takes the
 *   remainder, so the shares add up to the total exactly.
 * - Inside a row the units share equally, the last one taking the remainder.
 * - Every line gets at least a centavo — a down payment is never 0 — and no
 *   more than it costs.
 */
export function splitDownPayment(rows: DpRow[], total: number): DpSplit {
  const byLine = new Map<string, number>()
  const open = rows.filter((r) => r.fixedPerLine == null)
  if (open.length === 0) return { ok: true, byLine }

  const everything = rows.reduce((sum, r) => sum + r.amount, 0)
  if (total > everything + 0.005) return { ok: false, reason: 'too_large' }

  const openLines = open.reduce((sum, r) => sum + r.lineIds.length, 0)
  const openTotal = cents(total - fixedDownPaymentTotal(rows))
  if (openTotal + 1e-9 < MIN_PER_LINE * openLines) return { ok: false, reason: 'too_small' }

  const weight = open.reduce((sum, r) => sum + r.amount, 0)
  let allocated = 0
  open.forEach((row, index) => {
    const isLast = index === open.length - 1
    const proportional = weight > 0 ? (openTotal * row.amount) / weight : openTotal / open.length
    const share = isLast ? cents(openTotal - allocated) : cents(proportional)
    allocated = cents(allocated + share)

    const n = row.lineIds.length
    const perLine = cents(share / n)
    row.lineIds.forEach((lineId, i) => {
      byLine.set(lineId, i === n - 1 ? cents(share - perLine * (n - 1)) : perLine)
    })
  })

  // The last row takes the remainder, which can land outside what it may hold
  // when the rows' weights and the cap pull against each other. Refuse rather
  // than hand the server a line it will reject.
  for (const row of open) {
    const rowShare = row.lineIds.reduce((sum, id) => sum + (byLine.get(id) ?? 0), 0)
    if (rowShare > row.amount + 0.005) return { ok: false, reason: 'too_large' }
    if (rowShare + 1e-9 < MIN_PER_LINE * row.lineIds.length) {
      return { ok: false, reason: 'too_small' }
    }
  }
  return { ok: true, byLine }
}
