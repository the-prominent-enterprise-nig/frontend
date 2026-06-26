'use client'

import { Cake } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'
import { CALENDAR_EVENTS } from './CalendarWidget'

export default function EmployeeBirthdaysWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'

  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  const today = now.getDate()

  const birthdays = Object.entries(CALENDAR_EVENTS)
    .filter(([, label]) => label.toLowerCase().includes('birthday'))
    .map(([day, label]) => {
      const dayNum = parseInt(day)
      const isToday = dayNum === today
      const date = new Date(year, month, dayNum)
      const dateStr = date.toLocaleString('en-PH', { month: 'short', day: 'numeric' })
      return { dayNum, label, isToday, dateStr }
    })
    .sort((a, b) => {
      if (a.isToday !== b.isToday) return a.isToday ? -1 : 1
      const aDist = (a.dayNum - today + 31) % 31
      const bDist = (b.dayNum - today + 31) % 31
      return aDist - bDist
    })

  if (birthdays.length === 0) {
    return (
      <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">
        No birthdays in the Calendar this month.
      </div>
    )
  }

  const limit = isCompact ? 3 : 5

  return (
    <div className="flex flex-col gap-1">
      {birthdays.slice(0, limit).map(({ dayNum, label, isToday, dateStr }) => (
        <div
          key={dayNum}
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition ${isToday ? 'bg-purple-50 ring-1 ring-purple-200' : 'hover:bg-zinc-50'}`}
        >
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isToday ? 'bg-purple-600 text-white' : 'bg-zinc-100 text-zinc-500'}`}
          >
            <Cake className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-zinc-900">{label}</p>
            {!isCompact && <p className="text-[10px] text-zinc-400">From Calendar</p>}
          </div>
          <p
            className={`shrink-0 text-[10px] font-medium ${isToday ? 'text-purple-600' : 'text-zinc-400'}`}
          >
            {isToday ? 'Today' : dateStr}
          </p>
        </div>
      ))}
    </div>
  )
}
