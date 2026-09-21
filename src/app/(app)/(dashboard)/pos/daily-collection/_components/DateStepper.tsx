'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import { shiftIsoDate, todayIso } from '../_utils/business-date'

const STEP =
  'flex h-9 w-8 items-center justify-center bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-300 disabled:hover:text-gray-300'

interface Props {
  value: string
  onChange: (iso: string) => void
  /** While the form is being filled in, the date is what the edits belong to
   * — stepping off it would strand them on a report they were not typed
   * against. */
  disabled?: boolean
}

/**
 * The business date, stepped a day at a time.
 *
 * Forward movement stops at today: this report is the day's closed sessions,
 * so tomorrow has nothing to show and a stepper that walks into an empty
 * future reads as a bug. Typing a date is still allowed — reaching back a
 * month should not take thirty clicks.
 */
export default function DateStepper({ value, onChange, disabled = false }: Props) {
  const today = todayIso()
  const atToday = value >= today

  return (
    <div className="flex items-end gap-2">
      <label className="text-xs font-semibold text-gray-600">
        <span className="mb-1 block">Business date</span>
        <div className="flex items-center overflow-hidden rounded-lg border border-gray-300 bg-white">
          <Tooltip label="Previous day">
            <button
              type="button"
              aria-label="Previous day"
              className={`${STEP} border-r border-gray-200`}
              disabled={disabled}
              onClick={() => onChange(shiftIsoDate(value, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </Tooltip>
          <input
            type="date"
            className="h-9 border-0 px-2 text-sm font-normal text-gray-900 outline-none disabled:bg-white disabled:text-gray-400"
            value={value}
            max={today}
            disabled={disabled}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            aria-label="Business date"
          />
          <Tooltip label={atToday ? 'Today is the latest business date' : 'Next day'}>
            <button
              type="button"
              aria-label="Next day"
              className={`${STEP} border-l border-gray-200`}
              disabled={disabled || atToday}
              onClick={() => onChange(shiftIsoDate(value, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </label>

      {!atToday && (
        <button
          type="button"
          className="h-9 rounded-lg border border-prominent-purple-200 bg-prominent-purple-50 px-3 text-sm font-medium text-prominent-purple-900 transition-colors hover:bg-prominent-purple-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          onClick={() => onChange(today)}
        >
          Today
        </button>
      )}
    </div>
  )
}
