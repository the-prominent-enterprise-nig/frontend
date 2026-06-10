'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const EVENTS: Record<number, string> = {
  13: 'Birthday',
  15: 'Review',
  18: 'Team Building',
  20: 'Payroll Cutoff',
  22: 'Product Launch',
  28: 'Board Meeting',
}

export default function CalendarWidget() {
  const { variant } = useWidgetSize()
  const [month] = useState(4)
  const [year] = useState(2026)
  const today = 13

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' })

  // For xs/sm, only show event list (no calendar grid)
  if (variant === 'xs') {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold text-zinc-700 mb-1">
          {monthName} {year}
        </p>
        {Object.entries(EVENTS)
          .slice(0, 4)
          .map(([day, event]) => (
            <div key={day} className="flex items-center gap-2 text-xs text-zinc-600">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0" />
              <span className="font-medium text-zinc-800 shrink-0">May {day}</span>
              <span className="truncate">{event}</span>
            </div>
          ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <button className="rounded p-0.5 hover:bg-zinc-100 transition">
          <ChevronLeft className="h-3.5 w-3.5 text-zinc-500" />
        </button>
        <p className="text-xs font-semibold text-zinc-900">
          {monthName} {year}
        </p>
        <button className="rounded p-0.5 hover:bg-zinc-100 transition">
          <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {DAYS.map((d) => (
          <div key={d} className="py-0.5 text-center text-[10px] font-medium text-zinc-400">
            {d}
          </div>
        ))}
        {cells.map((day, i) => (
          <div key={i} className="flex flex-col items-center py-0.5">
            {day !== null && (
              <>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] transition
                  ${day === today ? 'bg-purple-600 text-white font-bold' : 'text-zinc-700 hover:bg-zinc-100'}`}
                >
                  {day}
                </span>
                {EVENTS[day] && <span className="mt-0.5 h-1 w-1 rounded-full bg-purple-400" />}
              </>
            )}
          </div>
        ))}
      </div>

      {variant === 'lg' && (
        <div className="border-t border-zinc-100 pt-2 space-y-1">
          {Object.entries(EVENTS).map(([day, event]) => (
            <div key={day} className="flex items-center gap-2 text-[10px] text-zinc-600">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0" />
              <span className="font-medium text-zinc-800 shrink-0">May {day}</span>
              <span className="truncate">{event}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
