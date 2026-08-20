'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, List, ChevronLeft, ChevronRight, Banknote, BellRing, X } from 'lucide-react'
import { collectionsCalendarApi, collectorsApi } from '@/src/libs/api/crm'
import { getBranches } from '../../installment-accounts/_actions/get-branches'
import CustomerPicker from '@/src/components/crm/CustomerPicker'
import type {
  CollectionsCalendarPayment,
  CollectionsCalendarReminder,
  CollectionsCalendarResponse,
} from '@/src/schema/crm/types'

type View = 'calendar' | 'events'

type CalendarItem =
  | { kind: 'payment'; date: string; data: CollectionsCalendarPayment }
  | { kind: 'reminder'; date: string; data: CollectionsCalendarReminder }

function formatPeso(n: number): string {
  return `₱${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  OVERDUE: 'bg-red-100 text-red-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  SENT: 'bg-zinc-100 text-zinc-600',
}

// Matches crm's own dashboard (page.tsx reminderStatusCls) so a reminder
// reads the same wherever it's shown.
function reminderStatusCls(status: string, isOverdue: boolean): string {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-700'
  if (isOverdue || status === 'overdue') return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-700'
}

const fieldClass =
  'rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

function PaymentRow({ payment }: { payment: CollectionsCalendarPayment }) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50">
        <Banknote className="h-3.5 w-3.5 text-emerald-600" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[13px] font-medium text-zinc-900">{payment.customerName}</p>
          <span className="shrink-0 font-semibold text-zinc-900">{formatPeso(payment.amount)}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
          <span
            className={`rounded-full px-1.5 py-0.5 font-medium ${PAYMENT_STATUS_STYLES[payment.arInvoiceStatus] ?? 'bg-zinc-100 text-zinc-600'}`}
          >
            {payment.arInvoiceStatus}
          </span>
          {payment.accountNumber && <span className="font-mono">{payment.accountNumber}</span>}
          {payment.collectorName && <span>{payment.collectorName}</span>}
        </div>
      </div>
    </div>
  )
}

function ReminderRow({ reminder }: { reminder: CollectionsCalendarReminder }) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-50">
        <BellRing className="h-3.5 w-3.5 text-prominent-purple-700" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[13px] font-medium text-zinc-900">
            {reminder.customerName ?? reminder.leadName ?? 'Reminder'}
          </p>
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${reminderStatusCls(reminder.status, reminder.isOverdue)}`}
          >
            {reminder.isOverdue ? 'Overdue' : reminder.status}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-zinc-500">
          {reminder.note ?? reminder.reminderType}
        </p>
      </div>
    </div>
  )
}

function DayDetailPanel({
  dateLabel,
  items,
  onClose,
}: {
  dateLabel: string
  items: CalendarItem[]
  onClose: () => void
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <p className="text-sm font-semibold text-zinc-900">{dateLabel}</p>
        <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="divide-y divide-zinc-100 px-4">
        {items.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-zinc-400">
            Nothing due or scheduled on this day.
          </p>
        ) : (
          items.map((item) =>
            item.kind === 'payment' ? (
              <PaymentRow key={`p-${item.data.id}`} payment={item.data} />
            ) : (
              <ReminderRow key={`r-${item.data.id}`} reminder={item.data} />
            )
          )
        )}
      </div>
    </div>
  )
}

export default function CollectionsCalendar() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [view, setView] = useState<View>('calendar')
  const [branchId, setBranchId] = useState('')
  const [collectorId, setCollectorId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [customerLabel, setCustomerLabel] = useState('')
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [collectors, setCollectors] = useState<{ id: string; name: string; stubNumber: string }[]>(
    []
  )
  const [data, setData] = useState<CollectionsCalendarResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const today = now.getDate()
  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear()
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' })

  useEffect(() => {
    getBranches().then((res) => {
      if (res.success && res.data) setBranches(res.data.data)
    })
  }, [])

  useEffect(() => {
    collectorsApi.list({ limit: 200, ...(branchId ? { branchId } : {}) }).then((res) => {
      if (res.success && res.data) setCollectors(res.data.data)
    })
  }, [branchId])

  useEffect(() => {
    const controller = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      setError(null)
      const startDate = dateKey(year, month, 1)
      const endDate = dateKey(year, month, new Date(year, month + 1, 0).getDate())
      const res = await collectionsCalendarApi.get({
        startDate,
        endDate,
        ...(branchId && { branchId }),
        ...(collectorId && { collectorId }),
        ...(customerId && { customerId }),
      })
      if (controller.signal.aborted) return
      if (res.success && res.data) setData(res.data)
      else setError(res.error ?? 'Failed to load the collections calendar')
      setLoading(false)
    }, 150)
    return () => {
      controller.abort()
      clearTimeout(t)
    }
  }, [year, month, branchId, collectorId, customerId])

  const items: CalendarItem[] = [
    ...(data?.payments ?? []).map(
      (p): CalendarItem => ({ kind: 'payment', date: p.dueDate.slice(0, 10), data: p })
    ),
    ...(data?.reminders ?? []).map(
      (r): CalendarItem => ({ kind: 'reminder', date: r.dueAt.slice(0, 10), data: r })
    ),
  ]
  const grouped: Record<string, CalendarItem[]> = {}
  for (const item of items) {
    grouped[item.date] = [...(grouped[item.date] ?? []), item]
  }
  const sortedEntries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))

  function changeMonth(delta: number) {
    const d = new Date(year, month + delta)
    setMonth(d.getMonth())
    setYear(d.getFullYear())
    setSelectedDate(null)
  }

  function dayLabel(key: string): string {
    const dayNum = Number(key.split('-')[2])
    const isToday = isCurrentMonth && dayNum === today
    const d = new Date(key + 'T00:00:00')
    const weekday = d.toLocaleDateString('default', { weekday: 'short' })
    return isToday
      ? `Today, ${weekday}, ${d.getDate()} ${monthName.slice(0, 3)}`
      : `${weekday}, ${d.getDate()} ${monthName.slice(0, 3)}`
  }

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const raw: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const totalCells = Math.ceil(raw.length / 7) * 7
  const cells: (number | null)[] = [...raw, ...Array(totalCells - raw.length).fill(null)]
  const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  const hasFilters = !!branchId || !!collectorId || !!customerId

  return (
    <div className="min-h-full w-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Collections Calendar</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Installment dues and reminders, grouped by day. Only shows dues from POS-originated
            installment plans — manually entered CRM collections accounts aren&apos;t itemized by
            due date yet.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={branchId}
            onChange={(e) => {
              setBranchId(e.target.value)
              setCollectorId('')
            }}
            className={fieldClass}
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={collectorId}
            onChange={(e) => setCollectorId(e.target.value)}
            className={fieldClass}
          >
            <option value="">All collectors</option>
            {collectors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.stubNumber} — {c.name}
              </option>
            ))}
          </select>

          <div className="w-64">
            <CustomerPicker
              value={customerId}
              selectedLabel={customerLabel}
              onChange={(id, label) => {
                setCustomerId(id)
                setCustomerLabel(label)
              }}
            />
          </div>

          {hasFilters && (
            <button
              onClick={() => {
                setBranchId('')
                setCollectorId('')
                setCustomerId('')
                setCustomerLabel('')
              }}
              className="text-[13px] font-medium text-zinc-500 hover:text-zinc-800"
            >
              Clear filters
            </button>
          )}

          <div className="ml-auto flex shrink-0 items-center rounded-full bg-zinc-100 p-0.5">
            <button
              onClick={() => setView('calendar')}
              title="Calendar view"
              className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
                view === 'calendar'
                  ? 'bg-white text-prominent-purple-700 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView('events')}
              title="Agenda view"
              className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
                view === 'events'
                  ? 'bg-white text-prominent-purple-700 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
          <button onClick={() => changeMonth(-1)} className="rounded-lg p-1.5 hover:bg-zinc-100">
            <ChevronLeft className="h-4 w-4 text-zinc-500" />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-900">
              {monthName} {year}
            </p>
            {data && (
              <p className="text-[11px] text-zinc-400">
                {data.meta.totalPaymentsDue} due · {formatPeso(data.meta.totalPaymentsAmount)} ·{' '}
                {data.meta.totalReminders} reminder{data.meta.totalReminders !== 1 ? 's' : ''}
                {data.meta.totalOverdueReminders > 0 &&
                  ` (${data.meta.totalOverdueReminders} overdue)`}
              </p>
            )}
          </div>
          <button onClick={() => changeMonth(1)} className="rounded-lg p-1.5 hover:bg-zinc-100">
            <ChevronRight className="h-4 w-4 text-zinc-500" />
          </button>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-zinc-200 bg-white py-16 text-[13px] text-zinc-400 shadow-sm">
            Loading…
          </div>
        ) : view === 'calendar' ? (
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
                const key = day !== null ? dateKey(year, month, day) : null
                const dayItems = key ? (grouped[key] ?? []) : []
                const hasPayments = dayItems.some((it) => it.kind === 'payment')
                const hasReminders = dayItems.some((it) => it.kind === 'reminder')
                const isToday = isCurrentMonth && day === today
                const isSelected = key !== null && key === selectedDate
                return (
                  <div
                    key={i}
                    onClick={key ? () => setSelectedDate(isSelected ? null : key) : undefined}
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
                          {hasPayments && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          )}
                          {hasReminders && (
                            <span className="h-1.5 w-1.5 rounded-full bg-prominent-purple-500" />
                          )}
                        </span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : sortedEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-16 text-center shadow-sm">
            <p className="text-sm font-medium text-zinc-500">Nothing due or scheduled this month</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedEntries.map(([key, dayItems]) => (
              <div key={key} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="mb-1 text-[12px] font-bold text-zinc-500">{dayLabel(key)}</p>
                <div className="divide-y divide-zinc-100">
                  {dayItems.map((item) =>
                    item.kind === 'payment' ? (
                      <PaymentRow key={`p-${item.data.id}`} payment={item.data} />
                    ) : (
                      <ReminderRow key={`r-${item.data.id}`} reminder={item.data} />
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'calendar' && selectedDate && (
          <DayDetailPanel
            dateLabel={dayLabel(selectedDate)}
            items={grouped[selectedDate] ?? []}
            onClose={() => setSelectedDate(null)}
          />
        )}
      </div>
    </div>
  )
}
