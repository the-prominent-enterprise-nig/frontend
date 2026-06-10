'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BellRing,
  Check,
  Phone,
  Mail,
  MapPin,
  MoreHorizontal,
  AlertTriangle,
  Clock,
  CalendarDays,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react'
import { remindersApi } from '@/src/libs/api/crm'
import type { Reminder, ReminderType } from '@/src/schema/crm/types'

// ── Utilities ──────────────────────────────────────────────────────────────────

function fmtRelative(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  const abs = Math.abs(diff)
  const mins = Math.round(abs / 60_000)
  const hrs = Math.round(abs / 3_600_000)
  const days = Math.round(abs / 86_400_000)
  const past = diff < 0
  if (mins < 60) return past ? `${mins}m ago` : `in ${mins}m`
  if (hrs < 24) return past ? `${hrs}h ago` : `in ${hrs}h`
  if (days === 1) return past ? 'yesterday' : 'tomorrow'
  return past ? `${days}d ago` : `in ${days}d`
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const TYPE_META: Record<
  ReminderType,
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  call: { icon: Phone, color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200', label: 'Call' },
  email: {
    icon: Mail,
    color: 'text-violet-600',
    bg: 'bg-violet-50 border-violet-200',
    label: 'Email',
  },
  visit: {
    icon: MapPin,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
    label: 'Visit',
  },
  other: {
    icon: MoreHorizontal,
    color: 'text-gray-500',
    bg: 'bg-gray-50 border-gray-200',
    label: 'Other',
  },
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm animate-pulse">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-xl bg-gray-100 shrink-0" />
        <div className="flex-1 space-y-2.5 pt-0.5">
          <div className="h-3.5 w-2/5 rounded-full bg-gray-100" />
          <div className="h-2.5 w-3/5 rounded-full bg-gray-100" />
          <div className="h-2.5 w-1/4 rounded-full bg-gray-100" />
        </div>
        <div className="h-8 w-24 rounded-xl bg-gray-100 shrink-0" />
      </div>
    </div>
  )
}

// ── Reminder card ──────────────────────────────────────────────────────────────

function ReminderCard({
  reminder,
  onComplete,
  completing,
}: {
  reminder: Reminder
  onComplete: (id: string) => void
  completing: string | null
}) {
  const isOverdue = reminder.isOverdue || reminder.status === 'overdue'
  const meta = TYPE_META[reminder.reminderType] ?? TYPE_META.other
  const Icon = meta.icon
  const isDone = completing === reminder.id

  return (
    <div
      className={`
        group relative rounded-2xl border bg-white shadow-sm transition-all duration-300
        ${isDone ? 'opacity-40 scale-[0.98]' : 'hover:shadow-md hover:-translate-y-px'}
        ${isOverdue ? 'border-red-200' : 'border-gray-100'}
      `}
    >
      {/* Left accent bar */}
      <div
        className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${
          isOverdue ? 'bg-red-400' : 'bg-orange-400'
        }`}
      />

      <div className="flex items-start gap-4 p-5 pl-6">
        {/* Type icon */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.bg}`}
        >
          <Icon className={`h-4.5 w-4.5 ${meta.color}`} strokeWidth={2} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}
            >
              {meta.label}
            </span>
            {isOverdue && (
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-2.5 w-2.5" />
                Overdue
              </span>
            )}
          </div>

          <p
            className={`text-[13px] font-semibold leading-snug truncate ${isOverdue ? 'text-red-900' : 'text-gray-900'}`}
          >
            {reminder.note ?? capitalize(reminder.reminderType)}
          </p>

          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {fmtRelative(reminder.dueAt)}
            </span>
            <span className="h-3 w-px bg-gray-200" />
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {fmtDate(reminder.dueAt)}
            </span>
          </div>
        </div>

        {/* Action */}
        <button
          onClick={() => onComplete(reminder.id)}
          disabled={isDone}
          className={`
            shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-semibold
            transition-all duration-150 disabled:cursor-not-allowed
            ${
              isOverdue
                ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
            }
          `}
        >
          {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          {isDone ? 'Completing…' : 'Complete'}
        </button>
      </div>
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  count,
  variant,
}: {
  title: string
  count: number
  variant: 'overdue' | 'upcoming'
}) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-lg ${
          variant === 'overdue' ? 'bg-red-100' : 'bg-orange-100'
        }`}
      >
        {variant === 'overdue' ? (
          <AlertTriangle className="h-3 w-3 text-red-600" />
        ) : (
          <BellRing className="h-3 w-3 text-orange-600" />
        )}
      </div>
      <h2
        className={`text-[13px] font-bold uppercase tracking-widest ${
          variant === 'overdue' ? 'text-red-700' : 'text-gray-700'
        }`}
      >
        {title}
      </h2>
      <span
        className={`text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full ${
          variant === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
        }`}
      >
        {count}
      </span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function RemindersList() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completing, setCompleting] = useState<string | null>(null)
  const [spinning, setSpinning] = useState(false)

  const load = useCallback(async () => {
    setSpinning(true)
    setError(null)
    const res = await remindersApi.list({ limit: 200 })
    if (res.success && res.data) {
      const items: Reminder[] = Array.isArray(res.data) ? res.data : ((res.data as any).data ?? [])
      setReminders(items)
    } else {
      setError(res.error ?? 'Failed to load reminders')
    }
    setLoading(false)
    setSpinning(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function complete(id: string) {
    setCompleting(id)
    const res = await remindersApi.complete(id)
    if (res.success) {
      await new Promise((r) => setTimeout(r, 400))
      load()
    }
    setCompleting(null)
  }

  const overdue = reminders.filter((r) => r.isOverdue || r.status === 'overdue')
  const upcoming = reminders.filter((r) => r.status === 'pending' && !r.isOverdue)
  const totalPending = overdue.length + upcoming.length

  const dueToday = upcoming.filter((r) => {
    const d = new Date(r.dueAt)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  }).length

  return (
    <div className="min-h-full bg-zinc-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur px-6 py-4">
        <div className="mx-auto max-w-3xl flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Reminders</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Follow-up tasks across all leads and customers
            </p>
          </div>
          <button
            onClick={load}
            disabled={spinning}
            className="flex items-center gap-1.5 rounded-xl bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${spinning ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-6 space-y-6">
        {/* Stats strip */}
        {!loading && !error && (
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'Total Pending',
                value: totalPending,
                icon: BellRing,
                style: 'bg-white border-gray-200 text-gray-900',
                iconStyle: 'bg-gray-100 text-gray-500',
              },
              {
                label: 'Overdue',
                value: overdue.length,
                icon: AlertTriangle,
                style:
                  overdue.length > 0
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-white border-gray-200 text-gray-900',
                iconStyle:
                  overdue.length > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500',
              },
              {
                label: 'Due Today',
                value: dueToday,
                icon: CalendarDays,
                style:
                  dueToday > 0
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-white border-gray-200 text-gray-900',
                iconStyle:
                  dueToday > 0 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`rounded-2xl border px-4 py-3 shadow-sm flex items-center gap-3 ${stat.style}`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${stat.iconStyle}`}
                >
                  <stat.icon className="h-4 w-4" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
                    {stat.label}
                  </p>
                  <p className="text-xl font-bold tabular-nums leading-none mt-0.5">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 flex items-center gap-3 text-red-700">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <div className="space-y-8">
            {/* Overdue */}
            {overdue.length > 0 && (
              <div>
                <SectionHeader title="Overdue" count={overdue.length} variant="overdue" />
                <div className="space-y-2.5">
                  {overdue.map((r) => (
                    <ReminderCard
                      key={r.id}
                      reminder={r}
                      onComplete={complete}
                      completing={completing}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <div>
                <SectionHeader title="Upcoming" count={upcoming.length} variant="upcoming" />
                <div className="space-y-2.5">
                  {upcoming.map((r) => (
                    <ReminderCard
                      key={r.id}
                      reminder={r}
                      onComplete={complete}
                      completing={completing}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {overdue.length === 0 && upcoming.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-14 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <p className="text-base font-semibold text-gray-900">All caught up</p>
                <p className="mt-1 text-sm text-gray-400">No open reminders right now.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
