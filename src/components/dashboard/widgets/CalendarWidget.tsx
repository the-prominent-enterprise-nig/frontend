'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
export const CALENDAR_EVENTS: Record<number, string> = {
  13: 'Birthday',
  15: 'Review',
  18: 'Team Building',
  20: 'Payroll Cutoff',
  22: 'Product Launch',
  28: 'Board Meeting',
}

export default function CalendarWidget() {
  const { variant } = useWidgetSize()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const today = now.getDate()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const raw: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to a full grid so the last row is always complete
  const totalCells = Math.ceil(raw.length / 7) * 7
  const cells = [...raw, ...Array(totalCells - raw.length).fill(null)]
  const numRows = totalCells / 7

  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' })

  if (variant === 'xs') {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold text-zinc-700 mb-1">
          {monthName} {year}
        </p>
        {Object.entries(CALENDAR_EVENTS)
          .slice(0, 4)
          .map(([day, event]) => (
            <div key={day} className="flex items-center gap-2 text-xs text-zinc-600">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0" />
              <span className="font-medium text-zinc-800 shrink-0">
                {monthName} {day}
              </span>
              <span className="truncate">{event}</span>
            </div>
          ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          className="rounded p-0.5 hover:bg-zinc-100 transition"
          onClick={() => {
            const d = new Date(year, month - 1)
            setMonth(d.getMonth())
            setYear(d.getFullYear())
          }}
        >
          <ChevronLeft className="h-3.5 w-3.5 text-zinc-500" />
        </button>
        <p className="text-xs font-semibold text-zinc-900">
          {monthName} {year}
        </p>
        <button
          className="rounded p-0.5 hover:bg-zinc-100 transition"
          onClick={() => {
            const d = new Date(year, month + 1)
            setMonth(d.getMonth())
            setYear(d.getFullYear())
          }}
        >
          <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
        </button>
      </div>

      {/* Bordered calendar grid */}
      <div className="overflow-hidden rounded-lg border border-zinc-200">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
          {DAYS.map((d, i) => (
            <div
              key={d}
              className={`py-1.5 text-center text-[10px] font-semibold text-zinc-400 ${i < 6 ? 'border-r border-zinc-200' : ''}`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const col = i % 7
            const row = Math.floor(i / 7)
            const isLastCol = col === 6
            const isLastRow = row === numRows - 1
            const isToday = day === today
            const hasEvent = day !== null && !!CALENDAR_EVENTS[day]

            return (
              <div
                key={i}
                className={[
                  'group flex flex-col items-center justify-center gap-0.5 py-1.5',
                  !isLastCol ? 'border-r border-zinc-100' : '',
                  !isLastRow ? 'border-b border-zinc-100' : '',
                  day === null ? 'bg-zinc-50/60' : 'hover:bg-zinc-50',
                ].join(' ')}
              >
                {day !== null && (
                  <>
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium transition
                        ${isToday ? 'bg-purple-600 text-white font-bold' : 'text-zinc-700 group-hover:bg-white group-hover:shadow-sm'}`}
                    >
                      {day}
                    </span>
                    {hasEvent && <span className="h-1 w-1 rounded-full bg-purple-400" />}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Event list — lg only */}
      {variant === 'lg' && (
        <div className="space-y-1">
          {Object.entries(CALENDAR_EVENTS).map(([day, event]) => (
            <div key={day} className="flex items-center gap-2 text-[10px] text-zinc-600">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0" />
              <span className="font-medium text-zinc-800 shrink-0">
                {monthName} {day}
              </span>
              <span className="truncate">{event}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
