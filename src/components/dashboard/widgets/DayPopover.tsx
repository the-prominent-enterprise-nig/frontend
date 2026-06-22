'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus } from 'lucide-react'
import type { CalendarEvent } from './CalendarWidget'
import { formatEventTime } from './CalendarWidget'

type Props = {
  date: string
  events: CalendarEvent[]
  anchor: { top: number; left: number }
  onClose: () => void
  onAdd: (event: Omit<CalendarEvent, 'id'>) => void
}

const POPOVER_WIDTH = 256

// 15-minute slots from 00:00 to 23:45
const TIME_SLOTS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4)
  const m = (i % 4) * 15
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

function formatSlot(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')}${suffix}`
}

function addHour(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const next = (h + 1) % 24
  return `${String(next).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Parse loose user input into HH:MM (24h). Returns null if unparseable.
// Handles: "9", "9am", "9:05", "9:05pm", "905", "905pm", "1205pm"
function parseTimeInput(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\s/g, '')
  if (!s) return null

  const periodMatch = s.match(/(am|pm)$/)
  const period = periodMatch?.[1]
  const digits = s.replace(/(am|pm)$/, '').replace(':', '')

  if (!/^\d{1,4}$/.test(digits)) return null

  let h: number, m: number
  if (digits.length <= 2) {
    h = parseInt(digits)
    m = 0
  } else if (digits.length === 3) {
    h = parseInt(digits[0])
    m = parseInt(digits.slice(1))
  } else {
    h = parseInt(digits.slice(0, 2))
    m = parseInt(digits.slice(2))
  }

  if (m > 59) return null
  if (period === 'pm' && h !== 12) h += 12
  if (period === 'am' && h === 12) h = 0
  if (h > 23) return null

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ── TimeSelect ────────────────────────────────────────────────────────────────

function TimeSelect({
  value,
  onChange,
  placeholder = 'Start',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [inputVal, setInputVal] = useState(value ? formatSlot(value) : '')
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Sync display when value changes externally
  useEffect(() => {
    setInputVal(value ? formatSlot(value) : '')
  }, [value])

  // Scroll to selected slot on open
  useEffect(() => {
    if (!open || !listRef.current) return
    const idx = value ? TIME_SLOTS.indexOf(value) : 0
    listRef.current.scrollTop = Math.max(0, idx * 32 - 64)
  }, [open, value])

  function handleBlur() {
    setOpen(false)
    if (!inputVal.trim()) {
      onChange('')
      return
    }
    const parsed = parseTimeInput(inputVal)
    if (parsed) {
      onChange(parsed)
      setInputVal(formatSlot(parsed))
    } else {
      // Revert to last valid value
      setInputVal(value ? formatSlot(value) : '')
    }
  }

  function handleSelect(slot: string) {
    onChange(slot)
    setInputVal(formatSlot(slot))
    setOpen(false)
  }

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`w-full rounded-lg border px-2.5 py-1.5 text-xs tabular-nums outline-none transition ${
          open
            ? 'border-purple-400 ring-1 ring-purple-200'
            : 'border-zinc-200 hover:border-purple-300'
        } ${inputVal ? 'text-zinc-800' : 'text-zinc-400'}`}
      />
      {open && (
        <div
          ref={listRef}
          className="absolute left-0 top-full z-60 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg"
        >
          {TIME_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // keep input focused
              onClick={() => handleSelect(slot)}
              className={`w-full px-3 py-2 text-left text-xs transition ${
                slot === value ? 'bg-purple-600 text-white' : 'text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {formatSlot(slot)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── DayPopover ────────────────────────────────────────────────────────────────

export default function DayPopover({ date, events, anchor, onClose, onAdd }: Props) {
  const [mounted, setMounted] = useState(false)
  const [mode, setMode] = useState<'view' | 'create'>('view')
  const [title, setTitle] = useState('')
  const [allDay, setAllDay] = useState(true)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (mode === 'create') titleInputRef.current?.focus()
  }, [mode])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  function handleStartTimeChange(v: string) {
    setStartTime(v)
    // Auto-set end time to +1h if unset or now before start
    if (!endTime || endTime <= v) setEndTime(addHour(v))
  }

  function handleSave() {
    if (!title.trim()) return
    onAdd({
      title: title.trim(),
      date,
      allDay: allDay || undefined,
      startTime: !allDay && startTime ? startTime : undefined,
      endTime: !allDay && endTime ? endTime : undefined,
    })
    setTitle('')
    setAllDay(true)
    setStartTime('')
    setEndTime('')
    setMode('view')
  }

  function handleCancel() {
    setTitle('')
    setAllDay(true)
    setStartTime('')
    setEndTime('')
    setMode('view')
  }

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('default', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const left = Math.min(anchor.left, window.innerWidth - POPOVER_WIDTH - 16)

  if (!mounted) return null

  return createPortal(
    <div
      ref={popoverRef}
      style={{ position: 'fixed', top: anchor.top, left }}
      className="z-50 w-64 rounded-xl bg-white shadow-xl ring-1 ring-zinc-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-xl border-b border-zinc-100 px-3 py-2.5">
        <p className="text-xs font-semibold text-zinc-800">{dateLabel}</p>
        <button
          onClick={onClose}
          className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Event list */}
      <div className="flex flex-col gap-1.5 px-3 py-2">
        {events.length === 0 && mode === 'view' && (
          <p className="py-0.5 text-xs text-zinc-400">No events</p>
        )}
        {events.map((ev) => (
          <div key={ev.id} className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-zinc-700">{ev.title}</p>
              <p className="text-[10px] text-zinc-400">{formatEventTime(ev)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Create form */}
      {mode === 'create' && (
        <div className="flex flex-col gap-2 border-t border-zinc-100 px-3 pb-3 pt-2">
          <input
            ref={titleInputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') handleCancel()
            }}
            placeholder="Event title"
            className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-800 placeholder-zinc-400 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200"
          />

          {/* All day toggle */}
          <label className="flex cursor-pointer items-center gap-2">
            <div
              onClick={() => setAllDay((v) => !v)}
              className={`relative h-4 w-7 rounded-full transition ${allDay ? 'bg-purple-500' : 'bg-zinc-300'}`}
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${allDay ? 'left-3.5' : 'left-0.5'}`}
              />
            </div>
            <span className="text-xs text-zinc-600">All day</span>
          </label>

          {/* Time range */}
          {!allDay && (
            <div className="flex items-center gap-1.5">
              <TimeSelect value={startTime} onChange={handleStartTimeChange} placeholder="Start" />
              <span className="shrink-0 text-[10px] text-zinc-400">—</span>
              <TimeSelect value={endTime} onChange={setEndTime} placeholder="End" />
            </div>
          )}

          <div className="flex gap-1.5">
            <button
              onClick={handleCancel}
              className="flex-1 rounded-lg border border-zinc-200 py-1.5 text-xs text-zinc-500 transition hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="flex-1 rounded-lg bg-purple-600 py-1.5 text-xs font-medium text-white transition hover:bg-purple-700 disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Add event button */}
      {mode === 'view' && (
        <div className="px-3 pb-3">
          <button
            onClick={() => setMode('create')}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 py-1.5 text-xs text-zinc-500 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-600"
          >
            <Plus className="h-3 w-3" />
            New event
          </button>
        </div>
      )}
    </div>,
    document.body
  )
}
