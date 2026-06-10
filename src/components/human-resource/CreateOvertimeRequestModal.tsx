'use client'

import { X, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Time } from '@internationalized/date'
import {
  ComboBox,
  Input,
  Button,
  Popover,
  ListBox,
  ListBoxItem,
  Label,
  Select,
  SelectValue,
} from 'react-aria-components'

type CreateOvertimeRequestModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave?: (data: {
    employee: string
    date: string
    startTime: string
    endTime: string
    totalHours: number
    reason: string
  }) => void
}

const DEFAULT_START = new Time(18, 0) // 6:00 PM
const DEFAULT_END = new Time(20, 0) // 8:00 PM

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1)) // '1'–'12'
const MINUTES = ['00', '15', '30', '45']

function computeTotalHours(start: Time, end: Time): number {
  const startMinutes = start.hour * 60 + start.minute
  let endMinutes = end.hour * 60 + end.minute
  // Handle overnight overtime (e.g. 10 PM – 1 AM)
  if (endMinutes <= startMinutes) endMinutes += 24 * 60
  return Math.round(((endMinutes - startMinutes) / 60) * 100) / 100
}

function formatTime(time: Time): string {
  const hour = time.hour % 12 || 12
  const minute = String(time.minute).padStart(2, '0')
  const period = time.hour < 12 ? 'AM' : 'PM'
  return `${hour}:${minute} ${period}`
}

function toTime(hour12: number, minute: number, period: 'AM' | 'PM'): Time {
  let hour24 = hour12 % 12
  if (period === 'PM') hour24 += 12
  return new Time(hour24, minute)
}

const inputClass =
  'w-14 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400'

const popoverClass =
  'z-50 max-h-48 min-w-[4rem] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg'

const itemClass =
  'cursor-pointer rounded-lg px-3 py-1.5 text-sm text-zinc-900 outline-none hover:bg-zinc-100 focus:bg-zinc-100 selected:bg-zinc-900 selected:text-white'

type TimePickerProps = {
  label: string
  value: Time
  onChange: (time: Time) => void
}

function TimePicker({ label, value, onChange }: TimePickerProps) {
  const hour12 = value.hour % 12 || 12
  const minute = String(value.minute).padStart(2, '0')
  const period: 'AM' | 'PM' = value.hour < 12 ? 'AM' : 'PM'

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-zinc-700">{label}</p>
      <div className="flex items-center gap-1.5">
        {/* Hour — typeable + dropdown */}
        <ComboBox
          allowsCustomValue
          inputValue={String(hour12)}
          onInputChange={(v) => {
            const n = parseInt(v, 10)
            if (!isNaN(n) && n >= 1 && n <= 12) onChange(toTime(n, value.minute, period))
          }}
          onSelectionChange={(k) => {
            if (k) onChange(toTime(Number(k), value.minute, period))
          }}
          aria-label="Hour"
        >
          <Label className="sr-only">Hour</Label>
          <div className="relative flex items-center">
            <Input className={inputClass} />
            <Button className="absolute right-1.5 text-zinc-400 outline-none">
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Popover className={popoverClass}>
            <ListBox>
              {HOURS.map((h) => (
                <ListBoxItem key={h} id={h} textValue={h} className={itemClass}>
                  {h}
                </ListBoxItem>
              ))}
            </ListBox>
          </Popover>
        </ComboBox>

        <span className="text-sm text-zinc-400">:</span>

        {/* Minute — typeable + dropdown */}
        <ComboBox
          allowsCustomValue
          inputValue={minute}
          onInputChange={(v) => {
            const n = parseInt(v, 10)
            if (!isNaN(n) && n >= 0 && n <= 59) onChange(toTime(hour12, n, period))
          }}
          onSelectionChange={(k) => {
            if (k) onChange(toTime(hour12, Number(k), period))
          }}
          aria-label="Minute"
        >
          <Label className="sr-only">Minute</Label>
          <div className="relative flex items-center">
            <Input className={inputClass} />
            <Button className="absolute right-1.5 text-zinc-400 outline-none">
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Popover className={popoverClass}>
            <ListBox>
              {MINUTES.map((m) => (
                <ListBoxItem key={m} id={m} textValue={m} className={itemClass}>
                  {m}
                </ListBoxItem>
              ))}
            </ListBox>
          </Popover>
        </ComboBox>

        {/* AM/PM — select only */}
        <Select
          selectedKey={period}
          onSelectionChange={(k) => onChange(toTime(hour12, value.minute, k as 'AM' | 'PM'))}
          aria-label="Period"
        >
          <Label className="sr-only">Period</Label>
          <Button className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-900 outline-none hover:bg-zinc-50 focus-visible:border-zinc-400">
            <SelectValue />
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
          </Button>
          <Popover className={popoverClass}>
            <ListBox>
              <ListBoxItem id="AM" textValue="AM" className={itemClass}>
                AM
              </ListBoxItem>
              <ListBoxItem id="PM" textValue="PM" className={itemClass}>
                PM
              </ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
      </div>
    </div>
  )
}

export default function CreateOvertimeRequestModal({
  isOpen,
  onClose,
  onSave,
}: CreateOvertimeRequestModalProps) {
  const [employee, setEmployee] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState<Time>(DEFAULT_START)
  const [endTime, setEndTime] = useState<Time>(DEFAULT_END)
  const [reason, setReason] = useState('')

  if (!isOpen) return null

  const totalHours = computeTotalHours(startTime, endTime)

  const handleSave = () => {
    onSave?.({
      employee,
      date,
      startTime: formatTime(startTime),
      endTime: formatTime(endTime),
      totalHours,
      reason,
    })

    // reset
    setEmployee('')
    setDate('')
    setStartTime(DEFAULT_START)
    setEndTime(DEFAULT_END)
    setReason('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Create Overtime Request</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Submit a new overtime request for an employee.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* FORM */}
        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-700">Employee</label>
            <input
              type="text"
              value={employee}
              onChange={(e) => setEmployee(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 outline-none"
            />
          </div>

          <div className="flex items-end">
            <div>
              <p className="mb-1 text-sm font-medium text-zinc-700">Total Hours</p>
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
                {totalHours} hr{totalHours !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <TimePicker label="Start Time" value={startTime} onChange={setStartTime} />

          <TimePicker label="End Time" value={endTime} onChange={setEndTime} />

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-700">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Project deadline"
              rows={3}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 outline-none"
            />
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  )
}
