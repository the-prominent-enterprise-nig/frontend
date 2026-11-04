'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-11" -> [2026, 11]. */
function parse(ym: string): [number, number] {
  const [y, m] = ym.split('-').map(Number)
  return [y, m]
}

function ym(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

/** One month earlier (-1) or later (+1). */
function shift(value: string, by: -1 | 1): string {
  const [y, m] = parse(value)
  const d = new Date(y, m - 1 + by, 1)
  return ym(d.getFullYear(), d.getMonth() + 1)
}

/**
 * Scenario 84 Part 5 — the POS Overview's month, picked rather than typed:
 * ‹ › step a month at a time, and the month's name opens a grid of the
 * year's twelve. Nothing after `max` can be picked. Replaces a native
 * month input, which let a month be typed in.
 */
export function MonthStepper({
  value,
  max,
  onChange,
}: {
  /** "YYYY-MM". */
  value: string
  /** "YYYY-MM" — the latest month that can be picked. */
  max: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [gridYear, setGridYear] = useState(() => parse(value)[0])
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const [year, month] = parse(value)
  const [maxYear] = parse(max)
  const label = new Date(year, month - 1, 1).toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
  })
  const atMax = value >= max
  const step =
    'inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent'

  return (
    <div ref={root} className="relative inline-flex items-center rounded-lg border border-gray-200">
      <button
        type="button"
        aria-label="Previous month"
        onClick={() => onChange(shift(value, -1))}
        className={step}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="overview-month"
        onClick={() => {
          setGridYear(year)
          setOpen((o) => !o)
        }}
        className="min-w-[9.5rem] rounded-md px-2 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-100"
      >
        {label}
      </button>
      <button
        type="button"
        aria-label="Next month"
        disabled={atMax}
        onClick={() => onChange(shift(value, 1))}
        className={step}
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Pick a month"
          className="absolute left-0 top-full z-20 mt-1 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous year"
              onClick={() => setGridYear((y) => y - 1)}
              className={step}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-gray-800">{gridYear}</span>
            <button
              type="button"
              aria-label="Next year"
              disabled={gridYear >= maxYear}
              onClick={() => setGridYear((y) => y + 1)}
              className={step}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {MONTHS.map((name, i) => {
              const candidate = ym(gridYear, i + 1)
              const chosen = candidate === value
              return (
                <button
                  key={name}
                  type="button"
                  disabled={candidate > max}
                  aria-pressed={chosen}
                  onClick={() => {
                    onChange(candidate)
                    setOpen(false)
                  }}
                  className={`rounded-md py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:text-gray-300 ${
                    chosen
                      ? 'bg-purple-200 font-semibold text-purple-800'
                      : 'text-gray-700 hover:bg-gray-100 disabled:hover:bg-transparent'
                  }`}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
