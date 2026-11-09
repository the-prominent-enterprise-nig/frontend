import type { PaceStatus } from '@/src/schema/pos/sales-reports'

/** Scenario 85 Part 5 — shared formatting for the Sales per Branch views. */

/** Whole pesos, as the client's scorecard shows them. */
export function peso(n: number | null): string {
  return n === null ? '—' : Math.round(n).toLocaleString('en-PH')
}

export function percent(n: number | null): string {
  return n === null ? '—' : `${Math.round(n * 100)}%`
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const month = (day: string): string => MONTHS[Number(day.slice(5, 7)) - 1]

/** '2026-10-05' → 'Oct 5'. */
export function shortDay(day: string): string {
  return `${month(day).slice(0, 3)} ${Number(day.slice(8))}`
}

/**
 * The From–To period as a heading:
 *   2026-10-01 → 2026-10-31  'OCTOBER 1–31, 2026'
 *   2026-09-15 → 2026-11-09  'SEPTEMBER 15 – NOVEMBER 9, 2026'
 *   2025-12-01 → 2026-01-31  'DECEMBER 1, 2025 – JANUARY 31, 2026'
 */
export function periodLabel(from: string, to: string): string {
  const day = (d: string): number => Number(d.slice(8))
  const year = to.slice(0, 4)
  if (from.slice(0, 7) === to.slice(0, 7)) {
    return `${month(from)} ${day(from)}–${day(to)}, ${year}`.toUpperCase()
  }
  const start =
    from.slice(0, 4) === year
      ? `${month(from)} ${day(from)}`
      : `${month(from)} ${day(from)}, ${from.slice(0, 4)}`
  return `${start} – ${month(to)} ${day(to)}, ${year}`.toUpperCase()
}

/** "Figures through Nov 9." when the period runs past today, else ''. */
export function throughNote(period: { to: string; asOf: string }): string {
  return period.asOf < period.to ? ` Figures through ${shortDay(period.asOf)}.` : ''
}

/**
 * Status colours are reserved for status and always ship with their label.
 * `bar` fills the Ach Rate bar, `pill` the Status cell.
 */
export const STATUS_STYLE: Record<PaceStatus, { label: string; bar: string; pill: string }> = {
  met: {
    label: 'Met',
    bar: 'bg-emerald-600',
    pill: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  },
  ahead: {
    label: 'Ahead',
    bar: 'bg-emerald-600',
    pill: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  },
  behind: {
    label: 'Behind',
    bar: 'bg-amber-600',
    pill: 'bg-amber-50 text-amber-800 ring-amber-200',
  },
  far_behind: {
    label: 'Far behind',
    bar: 'bg-red-600',
    pill: 'bg-red-50 text-red-800 ring-red-200',
  },
}
