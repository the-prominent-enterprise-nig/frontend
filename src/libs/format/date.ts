const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const RELATIVE_TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
]

/** "2 hours ago" / "in 3 days" style relative timestamp, falling back to "just now" under a minute. */
export function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  const diffSeconds = (date.getTime() - Date.now()) / 1000
  for (const [unit, secondsInUnit] of RELATIVE_TIME_UNITS) {
    if (Math.abs(diffSeconds) >= secondsInUnit) {
      return RELATIVE_TIME_FORMATTER.format(Math.round(diffSeconds / secondsInUnit), unit)
    }
  }
  return 'just now'
}

const COMPACT_RELATIVE_TIME_UNITS: [string, number][] = [
  ['y', 365 * 24 * 60 * 60],
  ['mo', 30 * 24 * 60 * 60],
  ['w', 7 * 24 * 60 * 60],
  ['d', 24 * 60 * 60],
  ['h', 60 * 60],
  ['m', 60],
]

/** Dense "14h" / "1d" / "2w" style timestamp for notification lists (mirrors Facebook's density). */
export function formatCompactRelativeTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  const diffSeconds = Math.max(0, (Date.now() - date.getTime()) / 1000)
  for (const [unit, secondsInUnit] of COMPACT_RELATIVE_TIME_UNITS) {
    if (diffSeconds >= secondsInUnit) {
      return `${Math.floor(diffSeconds / secondsInUnit)}${unit}`
    }
  }
  return 'now'
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

/** Whole months elapsed since `iso`, formatted like "5 Mo(s)". Never stored — always derived. */
export function formatAge(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  const now = new Date()
  let months = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth())
  if (now.getDate() < date.getDate()) months -= 1

  if (months < 1) return '< 1 Mo'
  return `${months} Mo(s)`
}
