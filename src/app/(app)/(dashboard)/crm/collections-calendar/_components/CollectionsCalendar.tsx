'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CalendarDays,
  List,
  ChevronLeft,
  ChevronRight,
  Banknote,
  BellRing,
  Search,
  X,
} from 'lucide-react'
import {
  collectionsCalendarApi,
  collectorsApi,
  accountingCustomersApi,
  leadsApi,
} from '@/src/libs/api/crm'
import { getBranches } from '../../installment-accounts/_actions/get-branches'
import { Select } from '@/src/components/ui/Select'
import type {
  CollectionsCalendarPayment,
  CollectionsCalendarReminder,
  CollectionsCalendarResponse,
} from '@/src/schema/crm/types'

// A collections reminder can be assigned to a lead that hasn't converted to
// a customer yet (Reminder.leadId), so searching "by customer name" alone
// misses anyone in that state — e.g. a lead with an upcoming follow-up call
// wouldn't be findable even though their reminder shows right on the
// calendar. This searches both customers and leads and tags each result so
// the right filter (customerId vs leadId) gets applied.
type Person = { type: 'customer' | 'lead'; id: string; label: string; sub: string }

function PersonPicker({
  value,
  onChange,
}: {
  value: Person | null
  onChange: (person: Person | null) => void
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const searchActive = open && search.trim().length >= 2

  useEffect(() => {
    if (!searchActive) return
    const controller = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      const [customerRes, leadRes] = await Promise.all([
        accountingCustomersApi.search(search),
        leadsApi.list({ search, limit: 10 }),
      ])
      if (controller.signal.aborted) return
      const customers: Person[] = customerRes.success
        ? (customerRes.data ?? []).map((c) => ({
            type: 'customer' as const,
            id: c.id,
            label: c.name,
            sub: c.email || c.phone || '—',
          }))
        : []
      const leads: Person[] = leadRes.success
        ? (leadRes.data?.data ?? []).map((l) => ({
            type: 'lead' as const,
            id: l.id,
            label: [l.firstName, l.lastName].filter(Boolean).join(' '),
            sub: l.company || l.email || l.phone || '—',
          }))
        : []
      setResults([...customers, ...leads].slice(0, 20))
      setLoading(false)
    }, 250)
    return () => {
      controller.abort()
      clearTimeout(t)
    }
  }, [search, searchActive])

  if (value && !open) {
    return (
      <div className="mt-1 flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              value.type === 'lead'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {value.type === 'lead' ? 'Lead' : 'Customer'}
          </span>
          <span className="truncate text-sm text-zinc-900">{value.label}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            onChange(null)
            setSearch('')
            setOpen(true)
          }}
          className="ml-2 shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="Change person"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-64">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search customer or lead by name…"
          className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
        />
      </div>
      {searchActive && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {loading && <p className="px-3 py-2 text-[13px] text-zinc-400">Searching…</p>}
          {!loading && results.length === 0 && (
            <p className="px-3 py-2 text-[13px] text-zinc-400">No customers or leads found.</p>
          )}
          {!loading &&
            results.map((p) => (
              <button
                key={`${p.type}-${p.id}`}
                type="button"
                onClick={() => {
                  onChange(p)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm hover:bg-zinc-50"
              >
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    p.type === 'lead'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {p.type === 'lead' ? 'Lead' : 'Customer'}
                </span>
                <span className="flex min-w-0 flex-col items-start">
                  <span className="truncate font-medium text-zinc-900">{p.label}</span>
                  <span className="truncate text-[12px] text-zinc-500">{p.sub}</span>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

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
  scroll,
}: {
  dateLabel: string
  items: CalendarItem[]
  onClose: () => void
  scroll?: boolean
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <p className="text-sm font-semibold text-zinc-900">{dateLabel}</p>
        <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className={`divide-y divide-zinc-100 px-4 ${scroll ? 'max-h-72 overflow-y-auto' : ''}`}>
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

// `compact` drops the standalone page's own outer background/padding, max-
// width cap, and big page title — used when this is embedded inside another
// page (the CRM dashboard) that already supplies its own card chrome and
// section heading. The standalone /crm/collections-calendar route renders
// with compact=false (the default) so it's unaffected.
export default function CollectionsCalendar({ compact = false }: { compact?: boolean } = {}) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [view, setView] = useState<View>('calendar')
  const [branchId, setBranchId] = useState('')
  const [collectorId, setCollectorId] = useState('')
  const [person, setPerson] = useState<Person | null>(null)
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [collectors, setCollectors] = useState<{ id: string; name: string; stubNumber: string }[]>(
    []
  )
  const [data, setData] = useState<CollectionsCalendarResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Compact mode shows the day's items as a popover anchored to the clicked
  // cell instead of the standalone page's push-down panel, so picking a date
  // doesn't shove the rest of the dashboard down. Close it on an outside
  // click since there's no longer an explicit "this row grew" cue.
  useEffect(() => {
    if (!compact || !selectedDate) return
    function handleClick(e: MouseEvent) {
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) {
        setSelectedDate(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [compact, selectedDate])

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

  async function loadCalendar() {
    setLoading(true)
    setError(null)
    const startDate = dateKey(year, month, 1)
    const endDate = dateKey(year, month, new Date(year, month + 1, 0).getDate())
    const res = await collectionsCalendarApi.get({
      startDate,
      endDate,
      ...(branchId && { branchId }),
      ...(collectorId && { collectorId }),
      ...(person?.type === 'customer' && { customerId: person.id }),
      ...(person?.type === 'lead' && { leadId: person.id }),
    })
    if (res.success && res.data) setData(res.data)
    else setError(res.error ?? 'Failed to load the collections calendar')
    setLoading(false)
  }

  useEffect(() => {
    const t = setTimeout(loadCalendar, 150)
    return () => clearTimeout(t)
    // loadCalendar itself isn't memoized — React Compiler auto-memoizes it
    // from these same reactive values, so listing them directly here (not
    // the function) is the correct dependency set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, branchId, collectorId, person])

  // Mirrors the rest of this dashboard's auto-refresh (30s poll +
  // refetch-on-focus) — this widget used to only refetch when a filter or
  // month changed, so a reminder someone else added wouldn't show up until
  // you touched a control.
  useEffect(() => {
    const interval = setInterval(loadCalendar, 30_000)
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') loadCalendar()
    }
    window.addEventListener('focus', loadCalendar)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', loadCalendar)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, branchId, collectorId, person])

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

  const hasFilters = !!branchId || !!collectorId || !!person
  // Only swap the grid out for a skeleton on the very first load. The 30s/
  // focus auto-refresh reuses this same `loading` flag, and without this
  // distinction the whole calendar would blank out and flash back in every
  // time it refreshes in the background — jarring for something the user
  // didn't ask for. Once we have data once, a background refresh just
  // updates in place (see the small spinner by the month label instead).
  const initialLoading = loading && !data

  return (
    <div className={compact ? 'w-full' : 'min-h-full w-full bg-zinc-50 p-4 md:p-6 lg:p-8'}>
      <div className={compact ? 'space-y-3' : 'mx-auto max-w-5xl space-y-4'}>
        {!compact && (
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Collections Calendar</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Installment dues and reminders, grouped by day. Only shows dues from POS-originated
              installment plans — manually entered CRM collections accounts aren&apos;t itemized by
              due date yet.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-44">
            <Select
              value={branchId}
              onChange={(v) => {
                setBranchId(v)
                setCollectorId('')
              }}
              options={[
                { value: '', label: 'All branches' },
                ...branches.map((b) => ({ value: b.id, label: b.name })),
              ]}
            />
          </div>

          <div className="w-52">
            <Select
              value={collectorId}
              onChange={setCollectorId}
              options={[
                { value: '', label: 'All collectors' },
                ...collectors.map((c) => ({ value: c.id, label: `${c.stubNumber} — ${c.name}` })),
              ]}
            />
          </div>

          <PersonPicker value={person} onChange={setPerson} />

          {hasFilters && (
            <button
              onClick={() => {
                setBranchId('')
                setCollectorId('')
                setPerson(null)
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

        <div
          className={`flex items-center justify-between rounded-xl border border-zinc-200 bg-white shadow-sm ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}
        >
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

        {initialLoading ? (
          <div className="flex items-center justify-center rounded-xl border border-zinc-200 bg-white py-16 text-[13px] text-zinc-400 shadow-sm">
            Loading…
          </div>
        ) : view === 'calendar' ? (
          <div
            className={`rounded-xl border border-zinc-200 bg-white shadow-sm ${compact ? 'overflow-visible' : 'overflow-hidden'}`}
          >
            <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
              {DAYS.map((d) => (
                <div
                  key={d}
                  className={`border-r border-zinc-200 text-center text-[11px] font-semibold text-zinc-400 last:border-r-0 ${compact ? 'py-1' : 'py-2'}`}
                >
                  {d}
                </div>
              ))}
            </div>
            <div ref={gridRef} className="relative grid grid-cols-7">
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
                    className={`flex flex-col items-center border-b border-r border-zinc-100 last:border-r-0 ${compact ? 'min-h-10 gap-0.5 py-1' : 'min-h-16 gap-1 py-2'} ${
                      day === null
                        ? 'bg-zinc-50/60'
                        : `cursor-pointer ${isSelected ? 'bg-purple-50' : 'hover:bg-zinc-50'}`
                    }`}
                  >
                    {day !== null && (
                      <>
                        <span
                          className={`flex items-center justify-center rounded-full font-medium ${compact ? 'h-5 w-5 text-[10px]' : 'h-6 w-6 text-[12px]'} ${
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
              {compact &&
                selectedDate &&
                (() => {
                  const idx = cells.findIndex(
                    (d) => d !== null && dateKey(year, month, d) === selectedDate
                  )
                  if (idx < 0) return null
                  const row = Math.floor(idx / 7)
                  const col = idx % 7
                  const ROW_H = 41
                  return (
                    <div
                      className="absolute z-20 w-64"
                      style={{
                        top: `${(row + 1) * ROW_H}px`,
                        ...(col <= 3
                          ? { left: `${col * (100 / 7)}%` }
                          : { right: `${(6 - col) * (100 / 7)}%` }),
                      }}
                    >
                      <DayDetailPanel
                        dateLabel={dayLabel(selectedDate)}
                        items={grouped[selectedDate] ?? []}
                        onClose={() => setSelectedDate(null)}
                        scroll
                      />
                    </div>
                  )
                })()}
            </div>
          </div>
        ) : sortedEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-16 text-center shadow-sm">
            <p className="text-sm font-medium text-zinc-500">Nothing due or scheduled this month</p>
          </div>
        ) : (
          <div className={compact ? 'max-h-96 space-y-4 overflow-y-auto pr-1' : 'space-y-4'}>
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

        {!compact && view === 'calendar' && selectedDate && (
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
