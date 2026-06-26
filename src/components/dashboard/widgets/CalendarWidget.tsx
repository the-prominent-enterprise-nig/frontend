'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react'
import { useWidgetSize, useWidgetHeader } from '../WidgetSizeContext'
import DayPopover from './DayPopover'
import { api } from '@/src/libs/api/client'

type EmployeeBirthday = {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string // YYYY-MM-DD
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// Kept as static export for EmployeeBirthdaysWidget
export const CALENDAR_EVENTS: Record<number, string> = {
  13: 'Birthday',
  15: 'Review',
  18: 'Team Building',
  20: 'Payroll Cutoff',
  22: 'Product Launch',
  28: 'Board Meeting',
}

export type CalendarEvent = {
  id: string
  title: string
  date: string // YYYY-MM-DD
  allDay?: boolean
  startTime?: string // HH:MM 24h
  endTime?: string // HH:MM 24h
}

export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

export function formatEventTime(ev: CalendarEvent): string {
  if (!ev.startTime) return 'All day'
  return ev.endTime
    ? `${formatTime(ev.startTime)} – ${formatTime(ev.endTime)}`
    : formatTime(ev.startTime)
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Short time for schedule left column: "9:00", "2:00", "11:30"
function formatTimeShort(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')}`
}

type SeedEntry = {
  day: number
  title: string
  startTime?: string
  endTime?: string
  allDay?: boolean
}

const SEED_ENTRIES: SeedEntry[] = [
  { day: 13, title: 'Birthday', allDay: true },
  { day: 15, title: 'Review', startTime: '14:00', endTime: '15:00' },
  { day: 18, title: 'Team Building', startTime: '09:00', endTime: '17:00' },
  { day: 20, title: 'Payroll Cutoff', allDay: true },
  { day: 22, title: 'PR General Meeting', startTime: '09:00', endTime: '10:00' },
  { day: 22, title: 'WARP Weekly Meeting', startTime: '11:00', endTime: '11:30' },
  { day: 22, title: 'Product Launch', startTime: '14:00', endTime: '15:00' },
  { day: 22, title: 'Board Review', startTime: '16:00', endTime: '17:00' },
  { day: 28, title: 'Board Meeting', startTime: '10:00', endTime: '11:00' },
]

function seedEvents(year: number, month: number): Record<string, CalendarEvent[]> {
  const result: Record<string, CalendarEvent[]> = {}
  for (const entry of SEED_ENTRIES) {
    const key = dateKey(year, month, entry.day)
    const ev: CalendarEvent = {
      id: `seed-${key}-${entry.title}`,
      title: entry.title,
      date: key,
      allDay: entry.allDay,
      startTime: entry.startTime,
      endTime: entry.endTime,
    }
    result[key] = [...(result[key] ?? []), ev]
  }
  return result
}

type View = 'calendar' | 'events'

export default function CalendarWidget() {
  const { variant } = useWidgetSize()
  const { setHeaderExtra } = useWidgetHeader()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [view, setView] = useState<View>('calendar')
  const [events, setEvents] = useState<Record<string, CalendarEvent[]>>(() =>
    seedEvents(now.getFullYear(), now.getMonth())
  )
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [popoverAnchor, setPopoverAnchor] = useState<{ top: number; left: number } | null>(null)
  const [employeeBirthdays, setEmployeeBirthdays] = useState<EmployeeBirthday[]>([])

  const today = now.getDate()
  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear()

  useEffect(() => {
    api.get<EmployeeBirthday[]>('/users/birthdays').then((res) => {
      if (res.success && res.data) setEmployeeBirthdays(res.data)
    })
  }, [])

  // Birthday events for the currently displayed month/year (re-derived on navigation)
  const birthdayEvents: Record<string, CalendarEvent[]> = {}
  for (const emp of employeeBirthdays) {
    const dob = new Date(emp.dateOfBirth + 'T00:00:00')
    if (dob.getMonth() !== month) continue
    const key = dateKey(year, month, dob.getDate())
    const ev: CalendarEvent = {
      id: `birthday-${emp.id}`,
      title: `${emp.firstName} ${emp.lastName}'s Birthday`,
      date: key,
      allDay: true,
    }
    birthdayEvents[key] = [...(birthdayEvents[key] ?? []), ev]
  }

  function allEventsForDate(key: string): CalendarEvent[] {
    return [...(birthdayEvents[key] ?? []), ...(events[key] ?? [])]
  }

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

  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const allKeys = Array.from(
    new Set([
      ...Object.keys(events).filter((k) => k.startsWith(monthPrefix)),
      ...Object.keys(birthdayEvents),
    ])
  ).sort()
  const monthEvents = allKeys.flatMap((key) => allEventsForDate(key))

  function handleCellClick(day: number, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const key = dateKey(year, month, day)
    if (selectedDate === key) {
      setSelectedDate(null)
      return
    }
    setSelectedDate(key)
    setPopoverAnchor({ top: rect.bottom + 6, left: rect.left })
  }

  function handleAddEvent(ev: Omit<CalendarEvent, 'id'>) {
    const id = `${ev.date}-${Math.random().toString(36).slice(2)}`
    setEvents((prev) => ({
      ...prev,
      [ev.date]: [...(prev[ev.date] ?? []), { ...ev, id }],
    }))
  }

  // xs: compact event list only
  if (variant === 'xs') {
    return (
      <div className="flex flex-col gap-1">
        <p className="mb-1 text-xs font-semibold text-zinc-700">
          {monthName} {year}
        </p>
        {monthEvents.slice(0, 4).map((ev) => {
          const dayNum = Number(ev.date.split('-')[2])
          return (
            <div key={ev.id} className="flex items-center gap-2 text-xs text-zinc-600">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
              <span className="shrink-0 font-medium text-zinc-800">
                {monthName} {dayNum}
              </span>
              <span className="truncate">{ev.title}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Month nav — shown in both views */}
      <div className="flex items-center justify-between">
        <button
          className="rounded p-0.5 transition hover:bg-zinc-100"
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
          className="rounded p-0.5 transition hover:bg-zinc-100"
          onClick={() => {
            const d = new Date(year, month + 1)
            setMonth(d.getMonth())
            setYear(d.getFullYear())
          }}
        >
          <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
        </button>
      </div>

      {/* Calendar grid */}
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
              const key = day !== null ? dateKey(year, month, day) : null
              const hasEvent = key !== null && allEventsForDate(key).length > 0
              const isSelected = key !== null && key === selectedDate
              return (
                <div
                  key={i}
                  onClick={day !== null ? (e) => handleCellClick(day, e) : undefined}
                  className={[
                    'group flex flex-col items-center justify-center gap-0.5 py-1.5',
                    !isLastCol ? 'border-r border-zinc-100' : '',
                    !isLastRow ? 'border-b border-zinc-100' : '',
                    day === null ? 'bg-zinc-50/60' : 'cursor-pointer',
                    isSelected ? 'bg-purple-50' : day !== null ? 'hover:bg-zinc-50' : '',
                  ]
                    .join(' ')
                    .trim()}
                >
                  {day !== null && (
                    <>
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium transition ${
                          isToday
                            ? 'bg-purple-600 font-bold text-white'
                            : isSelected
                              ? 'bg-purple-100 text-purple-700'
                              : 'text-zinc-700 group-hover:bg-white group-hover:shadow-sm'
                        }`}
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

      {/* Schedule list */}
      {view === 'events' && (
        <div className="flex flex-col gap-3">
          {monthEvents.length === 0 ? (
            <p className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-400">No events this month.</p>
          ) : (
            (() => {
              // Group by date
              const grouped: Record<string, CalendarEvent[]> = {}
              for (const ev of monthEvents) {
                grouped[ev.date] = [...(grouped[ev.date] ?? []), ev]
              }
              const upcomingEntries = Object.entries(grouped)
                .sort(([a], [b]) => a.localeCompare(b))
                // only today and future; past is accessible via calendar grid
                .filter(([key]) => {
                  const dayNum = Number(key.split('-')[2])
                  return !isCurrentMonth || dayNum >= today
                })
              if (upcomingEntries.length === 0) {
                return (
                  <p className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-400">
                    No upcoming events this month.
                  </p>
                )
              }
              return upcomingEntries.map(([key, dayEvents]) => {
                const dayNum = Number(key.split('-')[2])
                const isToday = isCurrentMonth && dayNum === today
                const d = new Date(key + 'T00:00:00')
                const weekday = d.toLocaleDateString('default', { weekday: 'short' })
                const dateLabel = isToday
                  ? `Today, ${weekday}, ${d.getDate()} ${monthName.slice(0, 3)}`
                  : `${weekday}, ${d.getDate()} ${monthName.slice(0, 3)}`
                return (
                  <div key={key}>
                    <p
                      className={`mb-1.5 text-[11px] font-bold ${isToday ? 'text-zinc-900' : 'text-zinc-500'}`}
                    >
                      {dateLabel}
                    </p>
                    <div className="flex flex-col divide-y divide-zinc-100">
                      {dayEvents.map((ev) => (
                        <div key={ev.id} className="flex items-start gap-2.5 py-1.5">
                          <span className="w-9 shrink-0 pt-0.5 text-right text-[11px] font-semibold tabular-nums text-zinc-500">
                            {ev.startTime ? (
                              formatTimeShort(ev.startTime)
                            ) : (
                              <span className="text-[9px] font-normal">All day</span>
                            )}
                          </span>
                          <span className="mt-1 w-0.5 shrink-0 self-stretch rounded-full bg-purple-500" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-zinc-900">{ev.title}</p>
                            <p className="text-[10px] text-zinc-400">{formatEventTime(ev)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            })()
          )}
        </div>
      )}

      {/* Day popover */}
      {selectedDate && popoverAnchor && (
        <DayPopover
          date={selectedDate}
          events={allEventsForDate(selectedDate)}
          anchor={popoverAnchor}
          onClose={() => setSelectedDate(null)}
          onAdd={handleAddEvent}
        />
      )}
    </div>
  )
}
