'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react'
import { useWidgetSize, useWidgetHeader } from '../WidgetSizeContext'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
export const CALENDAR_EVENTS: Record<number, string> = {
  13: 'Birthday',
  15: 'Review',
  18: 'Team Building',
  20: 'Payroll Cutoff',
  22: 'Product Launch',
  28: 'Board Meeting',
}

type View = 'calendar' | 'events'

export default function CalendarWidget() {
  const { variant } = useWidgetSize()
  const { setHeaderExtra } = useWidgetHeader()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [view, setView] = useState<View>('calendar')
  const today = now.getDate()

  useEffect(() => {
    setHeaderExtra(
      <div className="flex shrink-0 items-center rounded-full bg-zinc-100 p-0.5">
        <button
          onClick={() => setView('calendar')}
          title="Calendar view"
          className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
            view === 'calendar'
              ? 'bg-white shadow-sm text-purple-600'
              : 'text-zinc-400 hover:text-zinc-600'
          }`}
        >
          <CalendarDays className="h-3 w-3" />
        </button>
        <button
          onClick={() => setView('events')}
          title="Events view"
          className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
            view === 'events'
              ? 'bg-white shadow-sm text-purple-600'
              : 'text-zinc-400 hover:text-zinc-600'
          }`}
        >
          <List className="h-3 w-3" />
        </button>
      </div>
    )
    return () => setHeaderExtra(null)
  }, [view, setHeaderExtra])
  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const raw: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const totalCells = Math.ceil(raw.length / 7) * 7
  const cells = [...raw, ...Array(totalCells - raw.length).fill(null)]
  const numRows = totalCells / 7
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' })

  // xs: compact event list only
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
      {/* Month nav (calendar view only) */}
      {view === 'calendar' ? (
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
      ) : (
        <p className="text-xs font-semibold text-zinc-900">
          {monthName} {year}
        </p>
      )}

      {/* Calendar grid view */}
      {view === 'calendar' && (
        <div className="overflow-hidden rounded-lg border border-zinc-200">
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
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const col = i % 7
              const row = Math.floor(i / 7)
              const isLastCol = col === 6
              const isLastRow = row === numRows - 1
              const isToday = isCurrentMonth && day === today
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
      )}

      {/* Events list view */}
      {view === 'events' && (
        <div className="flex flex-col gap-1">
          {Object.entries(CALENDAR_EVENTS).length === 0 ? (
            <p className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-400">No events this month.</p>
          ) : (
            Object.entries(CALENDAR_EVENTS).map(([day, event]) => {
              const dayNum = parseInt(day)
              const isToday = isCurrentMonth && dayNum === today
              const isPast = isCurrentMonth && dayNum < today
              return (
                <div
                  key={day}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition ${
                    isToday
                      ? 'bg-purple-50 ring-1 ring-purple-200'
                      : isPast
                        ? 'opacity-50 hover:opacity-100 hover:bg-zinc-50'
                        : 'hover:bg-zinc-50'
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-lg ${
                      isToday ? 'bg-purple-600 text-white' : 'bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    <span className="text-[9px] font-semibold uppercase leading-none tracking-wide">
                      {monthName.slice(0, 3)}
                    </span>
                    <span className="text-xs font-bold leading-tight">{dayNum}</span>
                  </div>
                  <p className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-900">
                    {event}
                  </p>
                  {isToday && (
                    <span className="shrink-0 rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-semibold text-purple-600">
                      Today
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
