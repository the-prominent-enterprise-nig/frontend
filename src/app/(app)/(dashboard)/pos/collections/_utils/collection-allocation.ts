/**
 * Collections — turning the cash a cashier took into what the server records.
 *
 * The server's contract is: `amount` is what settles the dues (principal), the
 * late penalty is sent on top of it, and the penalty is never part of the
 * receivable. The cashier thinks the other way round — "I took ₱10,809.75" —
 * and the screen's own "Total with penalty" figure is that number. Sending it
 * as `amount` lands the penalty on the next due as principal while the same
 * penalty is also booked as income. So the screen works in CASH and this turns
 * it into principal + penalty before anything is sent.
 */

/** Mirrors penalty-waiver.util.ts in the backend, which enforces it. */
export const PENALTY_RATE = 0.05

const r2 = (n: number) => Math.round(n * 100) / 100
const cents = (n: number) => Math.round(n * 100)

/** The penalty on `applied` pesos settled against a late due. A due paid in two
 * halves carries 5% on each half — 5% of the whole once both are in. */
export function penaltyOn(applied: number): number {
  return Math.round(Math.max(applied, 0) * PENALTY_RATE * 100) / 100
}

export interface AllocationLine {
  /** What the due still owes. */
  outstanding: number
  /** Rebate checked on this due — settles part of it without being cash. */
  rebateAmount: number
  /** The due is 15+ days late and its penalty checkbox is on. */
  penaltyApplies: boolean
}

/**
 * Splits the cash taken across the selected dues (given in due order): one due
 * is settled in full — its principal capped at what it still needs after its
 * own rebate, plus the penalty on it — before any leftover flows to the next.
 * Whatever is left once every due is covered lands on the last due as an
 * overpayment, rather than being silently dropped.
 *
 * The penalty is 5% of the part of a late due the payment settles (principal +
 * its rebate + any tax withheld, never more than what the due still needs), so
 * a due paid in two payments is charged on each. `amount + penaltyAmount` of
 * every line adds back up to the cash, to the centavo.
 */
export function allocateCash<T extends AllocationLine>(
  lines: T[],
  totalCash: number,
  withholding = 0
): (T & { amount: number; penaltyAmount: number })[] {
  let remaining = Math.max(r2(totalCash), 0)
  return lines.map((entry, i) => {
    const { outstanding, rebateAmount, penaltyApplies } = entry
    const isLast = i === lines.length - 1
    const needed = Math.max(r2(outstanding - rebateAmount), 0)
    const penaltyFor = (amount: number) =>
      penaltyApplies ? penaltyOn(Math.min(outstanding, amount + rebateAmount + withholding)) : 0

    let amount: number
    if (remaining <= 0) {
      amount = 0
    } else if (!isLast && remaining >= r2(needed + penaltyFor(needed))) {
      // The cash covers this due in full — its penalty included.
      amount = needed
    } else {
      // Cash short of the due, or the last due taking the rest: the smallest
      // principal whose own penalty reaches the cash. The penalty is then the
      // cash less that principal — the exact 5% when it divides, a centavo
      // under it when it does not (never over, so the server never refuses it).
      const reaches = (c: number) => cents(c / 100 + penaltyFor(c / 100)) >= cents(remaining)
      let low = 0
      let high = cents(remaining)
      while (low < high) {
        const mid = Math.floor((low + high) / 2)
        if (reaches(mid)) high = mid
        else low = mid + 1
      }
      // Nothing to settle but a rebate, whose own penalty already exceeds the
      // cash: keep the cash as principal rather than lose it. (The server
      // refuses a rebate on a payment that does not clear the due anyway.)
      amount = low === 0 ? (isLast ? remaining : Math.min(remaining, needed)) : low / 100
    }

    // A due the cash does not reach carries no penalty yet — it is charged
    // when it is paid.
    const penaltyAmount = amount > 0 ? r2(Math.min(remaining - amount, penaltyFor(amount))) : 0
    remaining = Math.max(r2(remaining - amount - penaltyAmount), 0)
    return { ...entry, amount, penaltyAmount }
  })
}

/**
 * The tenders the cashier typed (cash handed over per method, penalty
 * included) in the principal terms the server cuts a collection along. Each
 * tender takes its share of every due's cash in order; a due's principal is
 * spread over its cash in proportion, the last piece taking the rounding so
 * the principals add back up exactly.
 */
export function tendersToPrincipal(
  tenderCash: number[],
  allocated: { amount: number; penaltyAmount: number }[]
): number[] {
  const segments = allocated
    .map((a) => ({ cash: r2(a.amount + a.penaltyAmount), principal: a.amount }))
    .filter((s) => s.cash > 0)
  const totalPrincipal = r2(allocated.reduce((sum, a) => sum + a.amount, 0))
  const out: number[] = []
  let seg = 0
  let segCashLeft = segments[0]?.cash ?? 0
  let segPrincipalLeft = segments[0]?.principal ?? 0

  tenderCash.forEach((cash, j) => {
    if (j === tenderCash.length - 1) {
      out.push(r2(totalPrincipal - out.reduce((sum, p) => sum + p, 0)))
      return
    }
    let need = r2(cash)
    let principal = 0
    while (need > 0.004 && seg < segments.length) {
      const take = Math.min(need, segCashLeft)
      const part =
        take >= segCashLeft - 0.004
          ? segPrincipalLeft
          : r2((take * segments[seg].principal) / segments[seg].cash)
      principal = r2(principal + part)
      need = r2(need - take)
      segCashLeft = r2(segCashLeft - take)
      segPrincipalLeft = r2(segPrincipalLeft - part)
      if (segCashLeft <= 0.004) {
        seg += 1
        segCashLeft = segments[seg]?.cash ?? 0
        segPrincipalLeft = segments[seg]?.principal ?? 0
      }
    }
    out.push(principal)
  })
  return out
}
