'use client'

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

/** One month earlier (-1) or later (+1) of "YYYY-MM". */
function shift(value: string, by: -1 | 1): string {
  const [y, m] = value.split('-').map(Number)
  const d = new Date(y, m - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Scenario 84 Part 5 — the POS Overview's month, stepped rather than typed:
 * ‹ › move a month at a time, never past `max`. Replaces a native month
 * input, which let a month be typed in. No dropdown (Kian, 2026-11-04).
 */
export function MonthStepper({
  value,
  max,
  onChange,
}: {
  /** "YYYY-MM". */
  value: string
  /** "YYYY-MM" — the latest month that can be stepped to. */
  max: string
  onChange: (value: string) => void
}) {
  const [year, month] = value.split('-').map(Number)
  const label = new Date(year, month - 1, 1).toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
  })
  const atMax = value >= max
  const step =
    'inline-flex h-9 w-9 items-center justify-center text-prominent-purple-700 transition-colors hover:bg-prominent-purple-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent'

  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-prominent-purple-200 bg-white shadow-sm">
      <button
        type="button"
        aria-label="Previous month"
        onClick={() => onChange(shift(value, -1))}
        className={step}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="inline-flex min-w-[11rem] items-center justify-center gap-2 border-x border-prominent-purple-100 px-3 text-sm font-semibold text-prominent-purple-900">
        <CalendarDays className="h-4 w-4 text-prominent-purple-500" />
        <span data-testid="overview-month">{label}</span>
      </span>
      <button
        type="button"
        aria-label="Next month"
        disabled={atMax}
        onClick={() => onChange(shift(value, 1))}
        className={step}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
