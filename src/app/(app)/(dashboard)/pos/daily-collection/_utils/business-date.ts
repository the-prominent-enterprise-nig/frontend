/**
 * Business-date arithmetic for the Daily Collection Report.
 *
 * ISO `YYYY-MM-DD` strings throughout, which compare correctly with `<` and
 * `>` — no Date objects cross a component boundary, so nothing here can pick
 * up a timezone on the way.
 */

import { formatManilaTime, manilaDateOf, manilaToday } from '@/src/libs/format/manila-date'

/** Today's Manila business day — not toISOString() (UTC, a PH morning lands on
 * yesterday) and not the browser's clock (a device set to another zone). */
export function todayIso(): string {
  return manilaToday()
}

/**
 * The Manila calendar day a timestamp fell on — a shift that opened at 10pm
 * belongs to that evening's business date, not to the UTC day the instant
 * happens to land in.
 */
export function isoDateOf(timestamp: string): string {
  const at = new Date(timestamp)
  if (Number.isNaN(at.getTime())) return ''
  return manilaDateOf(at)
}

/**
 * The same calendar day `days` away. Built through the Date constructor's
 * local-time overload rather than Date.parse, which reads a bare
 * `YYYY-MM-DD` as UTC and lands on the wrong day either side of midnight.
 */
export function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return iso

  const shifted = new Date(y, m - 1, d + days)
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(
    shifted.getDate()
  ).padStart(2, '0')}`
}

/**
 * `5:48 PM` — when a form was filed, for an owner who has been waiting on it.
 *
 * Read in Manila time, the branch's: this is a single-country business and
 * "when did Mabini file" means the clock on the wall there. Returns an empty
 * string on anything unparseable rather than printing `Invalid Date` onto a
 * report.
 */
export function formatFiledTime(iso: string | null): string {
  if (!iso) return ''
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return formatManilaTime(at, { hour: 'numeric', minute: '2-digit' })
}
