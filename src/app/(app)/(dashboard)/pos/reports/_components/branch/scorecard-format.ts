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

/** '2026-10-01', '2026-10-31' → 'OCTOBER 1–31, 2026'. */
export function periodLabel(from: string, asOf: string): string {
  const month = MONTHS[Number(from.slice(5, 7)) - 1].toUpperCase()
  return `${month} ${Number(from.slice(8))}–${Number(asOf.slice(8))}, ${from.slice(0, 4)}`
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
