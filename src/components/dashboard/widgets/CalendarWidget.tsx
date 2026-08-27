'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, List, Clock, Cake } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'
import DayPopover from './DayPopover'
import { api } from '@/src/libs/api/client'
import {
  getCalendarEvents,
  createCalendarEvent,
} from '@/src/app/(app)/(dashboard)/_actions/calendar-events-actions'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'

type EmployeeBirthday = {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string // YYYY-MM-DD
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

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

function groupEventsByDate(list: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const result: Record<string, CalendarEvent[]> = {}
  for (const ev of list) {
    result[ev.date] = [...(result[ev.date] ?? []), ev]
  }
  return result
}

type View = 'calendar' | 'events'

export default function CalendarWidget() {
  const { variant } = useWidgetSize()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [view, setView] = useState<View>('calendar')
  const [events, setEvents] = useState<Record<string, CalendarEvent[]>>({})
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [popoverAnchor, setPopoverAnchor] = useState<{ top: number; left: number } | null>(null)
  const [employeeBirthdays, setEmployeeBirthdays] = useState<EmployeeBirthday[]>([])

  const today = now.getDate()
  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear()
  const branchId = usePosBranchContext((s) => s.branchId)

  useEffect(() => {
    api.get<EmployeeBirthday[]>('/users/birthdays').then((res) => {
      if (res.success && res.data) setEmployeeBirthdays(res.data)
    })
  }, [])

  // Re-fetch real calendar events whenever the displayed month/year changes,
  // or the dashboard's branch filter changes — branch-scoped events only
  // show while that branch is selected; enterprise-wide ones always show.
  useEffect(() => {
    let cancelled = false
    getCalendarEvents(year, month + 1, branchId ?? undefined).then((res) => {
      if (cancelled) return
      if (res.success && res.data) setEvents(groupEventsByDate(res.data))
    })
    return () => {
      cancelled = true
    }
  }, [year, month, branchId])

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

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const raw: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const totalCells = Math.ceil(raw.length / 7) * 7
  const cells = [...raw, ...Array(totalCells - raw.length).fill(null)]
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

  async function handleAddEvent(ev: Omit<CalendarEvent, 'id'>) {
    const res = await createCalendarEvent({ ...ev, branchId: branchId ?? undefined })
    if (!res.success || !res.data) return
    const created = res.data
    setEvents((prev) => ({
      ...prev,
      [created.date]: [...(prev[created.date] ?? []), created],
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
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${ev.id.startsWith('birthday-') ? 'bg-pink-500' : 'bg-prominent-purple-500'}`}
              />
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

  const viewToggle = (
    <div className="flex shrink-0 items-center rounded-full bg-zinc-100 p-0.5">
      <button
        onClick={() => setView('calendar')}
        title="Calendar view"
        className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
          view === 'calendar'
            ? 'bg-white text-prominent-purple-700 shadow-sm'
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
            ? 'bg-white text-prominent-purple-700 shadow-sm'
            : 'text-zinc-400 hover:text-zinc-600'
        }`}
      >
        <List className="h-3 w-3" />
      </button>
    </div>
  )

  // Month nav — shown in both views, alongside the calendar/events toggle.
  // Both flanks are flex-1 so the month label sits truly centered (like
  // CRM's) no matter how wide the toggle grouped into the right flank is.
  const navRow = (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex flex-1 items-center">
        <button
          className="rounded-lg p-1.5 hover:bg-zinc-100"
          onClick={() => {
            const d = new Date(year, month - 1)
            setMonth(d.getMonth())
            setYear(d.getFullYear())
          }}
        >
          <ChevronLeft className="h-4 w-4 text-zinc-500" />
        </button>
      </div>
      <p className="shrink-0 text-center text-sm font-semibold text-zinc-900">
        {monthName} {year}
      </p>
      <div className="flex flex-1 items-center justify-end gap-2">
        <button
          className="rounded-lg p-1.5 hover:bg-zinc-100"
          onClick={() => {
            const d = new Date(year, month + 1)
            setMonth(d.getMonth())
            setYear(d.getFullYear())
          }}
        >
          <ChevronRight className="h-4 w-4 text-zinc-500" />
        </button>
        {viewToggle}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-2">
      {/* Nav bar and grid as two separate cards, matching CRM exactly */}
      {view === 'calendar' && (
        <>
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">{navRow}</div>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
              {DAYS.map((d) => (
                <div
                  key={d}
                  className="border-r border-zinc-200 py-2 text-center text-[11px] font-semibold text-zinc-400 last:border-r-0"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((day, i) => {
                const isToday = isCurrentMonth && day === today
                const key = day !== null ? dateKey(year, month, day) : null
                const hasOwnEvent = key !== null && (events[key] ?? []).length > 0
                const hasBirthday = key !== null && (birthdayEvents[key] ?? []).length > 0
                const isSelected = key !== null && key === selectedDate
                return (
                  <div
                    key={i}
                    onClick={day !== null ? (e) => handleCellClick(day, e) : undefined}
                    className={`flex min-h-[64px] flex-col items-center gap-1 border-b border-r border-zinc-100 py-2 last:border-r-0 ${
                      day === null
                        ? 'bg-zinc-50/60'
                        : `cursor-pointer ${isSelected ? 'bg-purple-50' : 'hover:bg-zinc-50'}`
                    }`}
                  >
                    {day !== null && (
                      <>
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium ${
                            isToday
                              ? 'bg-prominent-purple-700 font-bold text-white'
                              : isSelected
                                ? 'bg-purple-100 text-prominent-purple-700'
                                : 'text-zinc-700'
                          }`}
                        >
                          {day}
                        </span>
                        <span className="flex items-center gap-0.5">
                          {hasOwnEvent && (
                            <span className="h-1.5 w-1.5 rounded-full bg-prominent-purple-500" />
                          )}
                          {hasBirthday && <span className="h-1.5 w-1.5 rounded-full bg-pink-500" />}
                        </span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Schedule list — nav bar as its own card, matching the calendar view */}
      {view === 'events' && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">{navRow}</div>
          {monthEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-8 text-center shadow-sm">
              <p className="text-xs font-medium text-zinc-500">No events this month.</p>
            </div>
          ) : (
            (() => {
              // Group by date
              const grouped: Record<string, CalendarEvent[]> = {}
              for (const ev of monthEvents) {
                grouped[ev.date] = [...(grouped[ev.date] ?? []), ev]
              }
              const sortedEntries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
              return sortedEntries.map(([key, dayEvents]) => {
                const dayNum = Number(key.split('-')[2])
                const isToday = isCurrentMonth && dayNum === today
                const d = new Date(key + 'T00:00:00')
                const weekday = d.toLocaleDateString('default', { weekday: 'short' })
                const dateLabel = isToday
                  ? `Today, ${weekday}, ${d.getDate()} ${monthName.slice(0, 3)}`
                  : `${weekday}, ${d.getDate()} ${monthName.slice(0, 3)}`
                return (
                  <div
                    key={key}
                    className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                  >
                    <p
                      className={`mb-1 text-[12px] font-bold ${isToday ? 'text-zinc-900' : 'text-zinc-500'}`}
                    >
                      {dateLabel}
                    </p>
                    <div className="flex flex-col divide-y divide-zinc-100">
                      {dayEvents.map((ev) => {
                        const isBirthday = ev.id.startsWith('birthday-')
                        const Icon = isBirthday ? Cake : ev.startTime ? Clock : CalendarDays
                        return (
                          <div key={ev.id} className="flex items-start gap-2.5 py-1.5">
                            <span
                              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                                isBirthday ? 'bg-pink-50' : 'bg-purple-50'
                              }`}
                            >
                              <Icon
                                className={`h-3.5 w-3.5 ${isBirthday ? 'text-pink-600' : 'text-prominent-purple-700'}`}
                              />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-zinc-900">
                                {ev.title}
                              </p>
                              <p className="text-[10px] text-zinc-400">{formatEventTime(ev)}</p>
                            </div>
                          </div>
                        )
                      })}
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
