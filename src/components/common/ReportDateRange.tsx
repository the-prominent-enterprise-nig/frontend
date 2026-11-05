'use client'

import { useMemo } from 'react'
import { manilaDateOf } from '@/src/libs/format/manila-date'

export interface DateRange {
  from: string
  to: string
}

interface Props {
  value: DateRange
  onChange: (next: DateRange) => void
  /** Hides the preset chips when a report only needs raw from/to inputs. */
  showPresets?: boolean
  disabled?: boolean
}

type PresetKey = 'today' | 'week' | 'mtd' | 'qtd' | 'ytd' | 'lastMonth'

const PRESET_LABELS: Record<PresetKey, string> = {
  today: 'Today',
  week: 'This Week',
  mtd: 'MTD',
  qtd: 'QTD',
  ytd: 'YTD',
  lastMonth: 'Last Month',
}

/** 'YYYY-MM-DD' for a calendar date — UTC maths on a date-only value, so no
 * clock or timezone is involved. Month/day overflow rolls over like Date. */
function iso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10)
}

/** Resolves a preset against `now`, which the caller never passes in
 * production — it exists so the range maths stays unit-testable. */
export function resolvePreset(key: PresetKey, now = new Date()): DateRange {
  // The business day in Manila, whatever the browser's timezone.
  const today = manilaDateOf(now)
  const y = Number(today.slice(0, 4))
  const m = Number(today.slice(5, 7)) - 1
  const d = Number(today.slice(8, 10))

  switch (key) {
    case 'today':
      return { from: today, to: today }
    case 'week': {
      // Week starts Monday, matching PH business convention.
      const day = (new Date(Date.UTC(y, m, d)).getUTCDay() + 6) % 7
      return { from: iso(y, m, d - day), to: today }
    }
    case 'mtd':
      return { from: iso(y, m, 1), to: today }
    case 'qtd':
      return { from: iso(y, Math.floor(m / 3) * 3, 1), to: today }
    case 'ytd':
      return { from: iso(y, 0, 1), to: today }
    case 'lastMonth':
      return { from: iso(y, m - 1, 1), to: iso(y, m, 0) }
  }
}

/** Shared date-range control for the Scenario 47 reports — the client's
 * "generate reports based on time lines we set". */
export default function ReportDateRange({
  value,
  onChange,
  showPresets = true,
  disabled = false,
}: Props): React.JSX.Element {
  const activePreset = useMemo(() => {
    const keys = Object.keys(PRESET_LABELS) as PresetKey[]
    return keys.find((k) => {
      const r = resolvePreset(k)
      return r.from === value.from && r.to === value.to
    })
  }, [value.from, value.to])

  const invalid = Boolean(value.from && value.to && value.from > value.to)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          From
          <input
            type="date"
            value={value.from}
            max={value.to || undefined}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          To
          <input
            type="date"
            value={value.to}
            min={value.from || undefined}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </label>

        {showPresets && (
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(PRESET_LABELS) as PresetKey[]).map((key) => (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => onChange(resolvePreset(key))}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  activePreset === key
                    ? 'border-prominent-purple-600 bg-prominent-purple-50 text-prominent-purple-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {PRESET_LABELS[key]}
              </button>
            ))}
          </div>
        )}
      </div>

      {invalid && (
        <p className="text-xs text-red-600">
          The From date is after the To date — no rows will be returned.
        </p>
      )}
    </div>
  )
}
