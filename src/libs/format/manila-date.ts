/**
 * The business runs on Manila time (UTC+08:00, no daylight saving). Neither
 * the browser's clock nor the server's can be trusted for that: Next.js server
 * components render on a UTC host, and `toISOString().slice(0, 10)` is the UTC
 * date — the previous day for anything between 00:00 and 08:00 Manila.
 *
 * Use these for "which business day is it / was it" and for every date or
 * time shown to a user. Instants are still sent to and stored by the API as
 * ISO (UTC) strings.
 *
 * A date-only value (`@db.Date`, sent as `YYYY-MM-DDT00:00:00.000Z`) is UTC
 * midnight, which is 08:00 the same day in Manila, so it formats unchanged.
 */

export const MANILA_TZ = 'Asia/Manila'
export const MANILA_OFFSET = '+08:00'
const OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const YMD = /^\d{4}-\d{2}-\d{2}$/

/** 'YYYY-MM-DD' — the Manila business day an instant falls on. A string
 * that is already 'YYYY-MM-DD' is returned as is. */
export function manilaDateOf(input: Date | string | number): string {
  if (typeof input === 'string' && YMD.test(input)) return input
  return new Date(new Date(input).getTime() + OFFSET_MS).toISOString().slice(0, 10)
}

/** Today's business day in Manila, 'YYYY-MM-DD'. */
export function manilaToday(): string {
  return manilaDateOf(Date.now())
}

/** 'YYYY-MM' of an instant in Manila. */
export function manilaMonthOf(input: Date | string | number = Date.now()): string {
  return manilaDateOf(input).slice(0, 7)
}

/** Pure calendar arithmetic on a 'YYYY-MM-DD' — no clock involved. */
export function addDaysIso(ymd: string, days: number): string {
  const base = Date.parse(`${ymd.slice(0, 10)}T00:00:00.000Z`)
  return new Date(base + days * DAY_MS).toISOString().slice(0, 10)
}

/** The instant a Manila business day starts, as an ISO string for the API. */
export function manilaDayStartIso(ymd: string): string {
  return new Date(`${ymd.slice(0, 10)}T00:00:00.000${MANILA_OFFSET}`).toISOString()
}

/** The last millisecond of a Manila business day, as an ISO string. */
export function manilaDayEndIso(ymd: string): string {
  return new Date(`${ymd.slice(0, 10)}T23:59:59.999${MANILA_OFFSET}`).toISOString()
}

/** A bare 'YYYY-MM-DD' is read as that Manila day, not as UTC midnight. */
function toDate(input: Date | string | number): Date {
  if (typeof input === 'string' && YMD.test(input)) {
    return new Date(`${input}T12:00:00${MANILA_OFFSET}`)
  }
  return new Date(input)
}

/** `toLocaleDateString`, pinned to Manila. Defaults to 'en-PH'. */
export function formatManilaDate(
  input: Date | string | number,
  options: Intl.DateTimeFormatOptions = {},
  locale = 'en-PH'
): string {
  const date = toDate(input)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(locale, { ...options, timeZone: MANILA_TZ })
}

/** `toLocaleString` (date and time), pinned to Manila. */
export function formatManilaDateTime(
  input: Date | string | number,
  options: Intl.DateTimeFormatOptions = {},
  locale = 'en-PH'
): string {
  const date = toDate(input)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(locale, { ...options, timeZone: MANILA_TZ })
}

/** `toLocaleTimeString`, pinned to Manila. */
export function formatManilaTime(
  input: Date | string | number,
  options: Intl.DateTimeFormatOptions = {},
  locale = 'en-PH'
): string {
  const date = toDate(input)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString(locale, { ...options, timeZone: MANILA_TZ })
}
