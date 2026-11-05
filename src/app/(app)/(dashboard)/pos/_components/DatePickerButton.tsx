'use client'

import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

/** "2026-11-04" -> local Date at midnight. */
function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Scenario 84 Part 5 — one end of the POS Overview's date range, picked from
 * a calendar in the app's own style rather than the browser's date box
 * (which could be typed into). The whole month shows; a day outside
 * `min`..`max` is faint and can't be picked, and the month arrows stop at
 * them — so a range's From can't land after its To, nor its To before its
 * From. `rangeFrom`/`rangeTo` tint the days between the range's two ends.
 */
export function DatePickerButton({
  label,
  value,
  min,
  max,
  today,
  rangeFrom,
  rangeTo,
  onChange,
}: {
  /** "From" / "To" — the trigger's accessible name. */
  label: string
  /** "YYYY-MM-DD". */
  value: string
  /** "YYYY-MM-DD" — the earliest day that can be picked, if any. */
  min?: string
  /** "YYYY-MM-DD" — the latest day that can be picked. */
  max: string
  /** "YYYY-MM-DD" — real today: outlined, and the "Today" shortcut. */
  today: string
  rangeFrom?: string
  rangeTo?: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => value.slice(0, 7))
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

  const [vy, vm] = view.split('-').map(Number)
  const first = new Date(vy, vm - 1, 1)
  const daysInMonth = new Date(vy, vm, 0).getDate()
  const atMaxMonth = view >= max.slice(0, 7)
  const atMinMonth = !!min && view <= min.slice(0, 7)
  const pickable = (iso: string) => iso <= max && (!min || iso >= min)
  const shiftView = (by: -1 | 1) => {
    const d = new Date(vy, vm - 1 + by, 1)
    setView(toIso(d).slice(0, 7))
  }
  const [lo, hi] = rangeFrom && rangeTo ? [rangeFrom, rangeTo].sort() : [undefined, undefined]
  const shown = parseIso(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const step =
    'inline-flex h-8 w-8 items-center justify-center rounded-lg text-prominent-purple-700 transition-colors hover:bg-prominent-purple-50'

  // Leading blanks for the weekday the month starts on, then every day of the
  // month (Kian: "show the whole month"). Days after `max` show, faint, but
  // can't be picked.
  const cells: (string | null)[] = [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toIso(new Date(vy, vm - 1, i + 1))),
  ]

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-value={value}
        onClick={() => {
          setView(value.slice(0, 7))
          setOpen((o) => !o)
        }}
        className={`inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-sm font-semibold text-prominent-purple-900 shadow-sm transition-colors hover:bg-prominent-purple-50 ${
          open
            ? 'border-prominent-purple-300 ring-2 ring-prominent-purple-100'
            : 'border-prominent-purple-200'
        }`}
      >
        <CalendarDays className="h-4 w-4 text-prominent-purple-500" />
        {shown}
        <ChevronDown
          className={`h-3.5 w-3.5 text-prominent-purple-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`Pick the ${label.toLowerCase()} date`}
          style={{ transformOrigin: 'top left' }}
          className="animate-notif-dropdown absolute left-0 top-full z-20 mt-2 w-72 overflow-hidden rounded-xl border border-prominent-purple-100 bg-white shadow-xl shadow-prominent-purple-900/10"
        >
          <div className="flex items-center justify-between border-b border-prominent-purple-100 bg-prominent-purple-50/60 px-3 py-2">
            <button
              type="button"
              aria-label="Previous month"
              aria-hidden={atMinMonth}
              tabIndex={atMinMonth ? -1 : undefined}
              disabled={atMinMonth}
              onClick={() => shiftView(-1)}
              className={`${step} ${atMinMonth ? 'invisible' : ''}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold tracking-tight text-prominent-purple-900">
              {first.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
            </span>
            {/* The arrows hide, not grey, at the first / last month that
                has a day to pick — kept in the layout so the month stays
                centred. */}
            <button
              type="button"
              aria-label="Next month"
              aria-hidden={atMaxMonth}
              tabIndex={atMaxMonth ? -1 : undefined}
              disabled={atMaxMonth}
              onClick={() => shiftView(1)}
              className={`${step} ${atMaxMonth ? 'invisible' : ''}`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="px-3 pb-3 pt-2">
            <div className="grid grid-cols-7 gap-1 pb-1">
              {WEEKDAYS.map((d) => (
                <span
                  key={d}
                  className="text-center text-[11px] font-medium uppercase tracking-wide text-prominent-purple-400"
                >
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((iso, i) => {
                if (!iso) return <span key={`blank-${i}`} className="h-9" />
                if (!pickable(iso))
                  return (
                    <span
                      key={iso}
                      aria-hidden
                      className="inline-flex h-9 cursor-default items-center justify-center text-sm text-prominent-purple-200"
                    >
                      {parseIso(iso).getDate()}
                    </span>
                  )
                const chosen = iso === value
                const isToday = iso === today
                const inRange = !!lo && !!hi && iso > lo && iso < hi
                const isEnd = !!lo && (iso === lo || iso === hi)
                return (
                  <button
                    key={iso}
                    type="button"
                    aria-label={parseIso(iso).toLocaleDateString('en-PH', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    aria-pressed={chosen}
                    aria-current={isToday ? 'date' : undefined}
                    onClick={() => {
                      onChange(iso)
                      setOpen(false)
                    }}
                    className={`h-9 rounded-lg text-sm transition-colors ${
                      chosen
                        ? 'bg-prominent-purple-700 font-semibold text-white shadow-sm hover:bg-prominent-purple-800'
                        : isEnd
                          ? 'bg-prominent-purple-100 font-semibold text-prominent-purple-900 hover:bg-prominent-purple-200'
                          : inRange
                            ? 'bg-prominent-purple-50 text-prominent-purple-900 hover:bg-prominent-purple-100'
                            : isToday
                              ? 'font-semibold text-prominent-purple-700 ring-1 ring-inset ring-prominent-purple-200 hover:bg-prominent-purple-50'
                              : 'text-gray-700 hover:bg-prominent-purple-50 hover:text-prominent-purple-900'
                    }`}
                  >
                    {parseIso(iso).getDate()}
                  </button>
                )
              })}
            </div>
          </div>

          {value !== today && pickable(today) && (
            <div className="flex items-center justify-end border-t border-prominent-purple-100 px-3 py-2">
              <button
                type="button"
                onClick={() => {
                  onChange(today)
                  setOpen(false)
                }}
                className="whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold text-prominent-purple-700 transition-colors hover:bg-prominent-purple-50"
              >
                Today
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
