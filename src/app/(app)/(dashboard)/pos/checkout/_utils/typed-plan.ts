// Scenario 71 — what a cashier-typed installment plan is made of, and what is
// wrong with one. Mirrors the server's rules (TransactionsService
// .prepareManualPlanLine and its coverage check), so the cashier hears it at
// the till and not at Confirm.

import { manilaDateOf, manilaToday } from '@/src/libs/format/manila-date'

export const toCents = (n: number) => Math.round(n * 100)

const money = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)

/** yyyy-mm-dd of an instant on the Manila calendar — what an <input type="date"> holds. */
export function dateInputValue(d: Date): string {
  return manilaDateOf(d)
}

/** A date `months` months and `days` days from today (Manila), as yyyy-mm-dd. */
export function dateInputFromToday({
  months = 0,
  days = 0,
}: {
  months?: number
  days?: number
}): string {
  const [y, m, day] = manilaToday().split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, day))
  d.setUTCMonth(d.getUTCMonth() + months)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** The monthly installment that, with the down payment, covers a sale over a
 * number of months — rounded UP to the centavo so it never lands short. */
export function coveringMonthly(saleAmount: number, downPayment: number, months: number): number {
  if (months < 1) return 0
  return Math.max(0, Math.ceil((toCents(saleAmount) - toCents(downPayment)) / months)) / 100
}

/** What is wrong with a typed plan, in words a cashier can act on, or null.
 * `skipCoverage` leaves out the two checks that weigh the plan against the sale
 * (part left to finance, the terms covering it) — for one item's share of a
 * plan, where rounding can leave a share a centavo or two off and the plan as a
 * whole is what has to cover the sale. */
export function typedPlanProblem(plan: {
  months: string | undefined
  monthly: string | undefined
  firstDueDate: string | undefined
  downPayment: number
  saleAmount: number
  skipCoverage?: boolean
}): string | null {
  const months = Number(plan.months)
  if (!Number.isInteger(months) || months < 1 || months > 60) {
    return 'Months must be a whole number from 1 to 60.'
  }
  const monthly = Number(plan.monthly)
  if (!plan.monthly || !Number.isFinite(monthly) || monthly <= 0) {
    return 'Enter the monthly installment.'
  }
  if (!plan.firstDueDate || Number.isNaN(Date.parse(plan.firstDueDate))) {
    return 'Pick the first due date.'
  }
  if (plan.firstDueDate < dateInputFromToday({})) return 'The first due date cannot be in the past.'
  if (plan.firstDueDate > dateInputFromToday({ days: 366 })) {
    return 'The first due date is more than a year away.'
  }
  if (plan.downPayment < 0) return 'The down payment cannot be negative.'
  if (plan.skipCoverage) return null
  if (toCents(plan.downPayment) >= toCents(plan.saleAmount)) {
    return 'Part of the sale has to be left to pay in installments.'
  }
  if (toCents(plan.downPayment) + toCents(monthly) * months < toCents(plan.saleAmount)) {
    return `These terms do not cover the sale: they add up to ${money(
      plan.downPayment + monthly * months
    )}, the sale is ${money(plan.saleAmount)}.`
  }
  return null
}
