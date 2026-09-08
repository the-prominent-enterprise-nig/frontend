'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  Contact,
  BellRing,
  RefreshCw,
  ArrowUpRight,
  ChevronRight,
  Layers,
  MessageSquare,
  Phone,
  Mail,
  CalendarCheck,
  AlertTriangle,
  CheckCircle,
  Activity,
  LayoutGrid,
  PieChart,
  BarChart2,
  ShieldAlert,
} from 'lucide-react'
import { customersApi, remindersApi, interactionsApi, segmentsApi } from '@/src/libs/api/crm'
import CollectionsCalendar from './collections-calendar/_components/CollectionsCalendar'

// ── Utilities ─────────────────────────────────────────────────────────────────

function fmtNum(n: number) {
  if (!Number.isFinite(n)) return '0'
  return Math.round(n).toLocaleString('en-PH')
}

function fmtDateShort(dateStr?: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

function fmtDateTime(dateStr?: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// The dashboard's own /crm/reminders fetch already includes these relations
// server-side (reminder.service.ts findAll()) — just wasn't being rendered.
function reminderTarget(r: any): { label: string; href: string } | null {
  if (r.customer?.name && r.customerId) {
    return { label: r.customer.name, href: `/crm/customers/${r.customerId}` }
  }
  if (r.lead && r.leadId) {
    const name = [r.lead.firstName, r.lead.lastName].filter(Boolean).join(' ')
    return { label: name || 'Lead', href: `/crm/leads/${r.leadId}` }
  }
  if (r.installmentAccount?.accountNumber && r.installmentAccountId) {
    return {
      label: r.installmentAccount.accountNumber,
      href: `/crm/installment-accounts/${r.installmentAccountId}`,
    }
  }
  return null
}

function reminderStatusCls(status: string) {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-700'
  if (status === 'overdue') return 'bg-red-100 text-red-700'
  if (status === 'cancelled') return 'bg-gray-100 text-gray-500'
  return 'bg-amber-100 text-amber-700'
}

function interactionIcon(type: string) {
  if (type === 'call') return Phone
  if (type === 'email') return Mail
  if (type === 'meeting' || type === 'visit') return CalendarCheck
  return MessageSquare
}

function fmtStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const SOURCE_LABELS: Record<string, string> = {
  pos_walkin: 'Walk-in (POS)',
  sales: 'Sales',
  crm_lead: 'CRM Lead',
  online: 'Online',
}

const INTERACTION_COLORS: Record<string, string> = {
  call: '#0ea5e9',
  email: '#7c3aed',
  meeting: '#10b981',
  visit: '#f59e0b',
  message: '#f97316',
  other: '#94a3b8',
}

const COLORS = [
  '#f97316',
  '#0ea5e9',
  '#10b981',
  '#7c3aed',
  '#ef4444',
  '#f59e0b',
  '#06b6d4',
  '#22c55e',
  '#8b5cf6',
  '#ec4899',
]

// ── HBarChart ─────────────────────────────────────────────────────────────────

function HBarChart({
  items,
}: {
  items: { label: string; value: number; color: string; badge?: string }[]
}) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1 gap-2">
            <span className="text-xs text-gray-600 truncate">{item.label}</span>
            <span className="text-xs font-semibold text-gray-900 tabular-nums shrink-0">
              {item.badge ?? fmtNum(item.value)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(item.value / max) * 100}%`,
                backgroundColor: item.color,
                transition: 'width 0.7s ease-out',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── KpiCard ───────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  href,
  loading,
  urgent,
}: {
  label: string
  value: string
  sub?: string
  icon: any
  iconBg: string
  href?: string
  loading?: boolean
  urgent?: boolean
}) {
  const inner = (
    <div
      className={`
      rounded-xl border bg-white p-5 shadow-sm
      ${urgent ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}
      ${href ? 'hover:border-orange-200 hover:shadow-md transition-all cursor-pointer' : ''}
    `}
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className="h-[18px] w-[18px] text-white" />
        </div>
        {href && <ArrowUpRight className="h-3.5 w-3.5 text-gray-300" />}
      </div>
      {loading ? (
        <div className="mt-3 space-y-2">
          <div className="h-2.5 w-14 rounded bg-gray-200 animate-pulse" />
          <div className="h-7 w-20 rounded bg-gray-200 animate-pulse" />
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            {label}
          </p>
          <p
            className={`mt-0.5 text-2xl font-bold tabular-nums ${urgent ? 'text-red-700' : 'text-gray-900'}`}
          >
            {value}
          </p>
          {sub && <p className="mt-0.5 text-[11px] text-gray-400 truncate">{sub}</p>}
        </div>
      )}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

// ── Micro-components ──────────────────────────────────────────────────────────

function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className ?? ''}`} />
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-7 text-center gap-2">
      <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
        <CheckCircle className="h-4 w-4 text-orange-500" />
      </div>
      <p className="text-xs text-gray-500">{message}</p>
    </div>
  )
}

// ── Initial state ─────────────────────────────────────────────────────────────

const INIT = {
  loaded: false,
  lastUpdated: null as Date | null,
  totalCustomers: 0,
  activeCustomers: 0,
  overdueReminders: 0,
  pendingReminders: 0,
  dueTodayCount: 0,
  totalInteractions: 0,
  totalSegments: 0,
  customerSourceChart: [] as { label: string; value: number; color: string; badge?: string }[],
  interactionTypeChart: [] as { label: string; value: number; color: string; badge?: string }[],
  recentInteractions: [] as any[],
  overdueRemindersList: [] as any[],
  pendingRemindersList: [] as any[],
  segmentsList: [] as any[],
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CrmDashboardPage() {
  const [s, setS] = useState(INIT)
  const [spinning, setSpinning] = useState(false)

  const load = useCallback(async () => {
    setSpinning(true)
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    const settled = await Promise.allSettled([
      customersApi.list({ limit: 1 }), // 0 — only meta.total is read; see below
      remindersApi.list({ limit: 200 }), // 1
      interactionsApi.list({ limit: 100 }), // 2
      segmentsApi.list(), // 3 — CustomerSegment[]
      customersApi.sourceSummary(), // 4 — real counts, not capped like list()
      customersApi.statusSummary(), // 5 — real counts, not capped like list()
      interactionsApi.typeSummary(), // 6 — real counts, not capped like list()
    ])

    function pick(i: number): any {
      const r = settled[i]
      if (r.status === 'rejected') return null
      const v = r.value
      if (!v || v.success === false) return null
      return v.data ?? v
    }

    function arr(i: number): any[] {
      const raw = pick(i)
      if (!raw) return []
      if (Array.isArray(raw)) return raw
      if (Array.isArray(raw.data)) return raw.data
      return []
    }

    function total(i: number) {
      const raw = pick(i)
      if (!raw) return 0
      if (!Array.isArray(raw) && raw.meta?.total != null) return raw.meta.total
      return arr(i).length
    }

    // ── Customers ─────────────────────────────────────────────────────────────
    // Only `meta.total` from this fetch is used now — activeCustomers and
    // the source breakdown both moved to real aggregates below, so there's
    // no longer any reason to pull actual customer rows here.
    const totalCustomers = total(0)
    const activeCustomers = (pick(5) ?? { active: 0 }).active

    // Scenario 29 — real server-side counts per source channel
    // (customersApi.sourceSummary()), not a capped list fetch.
    const sourceSummary = arr(4) as { sourceChannel: string; count: number }[]
    const sourceGroups: Record<string, number> = {}
    sourceSummary.forEach(({ sourceChannel, count }) => {
      const src = sourceChannel ?? 'other'
      sourceGroups[src] = (sourceGroups[src] ?? 0) + count
    })
    const customerSourceChart = Object.entries(sourceGroups)
      .map(([k, v], i) => ({
        label: SOURCE_LABELS[k] ?? fmtStatus(k),
        value: v,
        color: COLORS[i % COLORS.length],
        badge: String(v),
      }))
      .sort((a, b) => b.value - a.value)

    // ── Reminders ─────────────────────────────────────────────────────────────
    // `isOverdue`/`status: 'overdue'` are never populated by the /crm/reminders
    // endpoint this dashboard calls (only /crm/reminders/mine computes
    // isOverdue, and no write path ever sets status to 'overdue') — mirror
    // Accounting's own live date-comparison pattern instead (accounting/page.tsx).
    const reminderList = arr(1)
    const isReminderOverdue = (r: any) =>
      r.status === 'pending' && new Date(r.dueAt).getTime() < now.getTime()
    const overdueRemindersList = reminderList
      .filter(isReminderOverdue)
      .sort((a: any, b: any) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    const overdueReminders = overdueRemindersList.length
    const pendingRemindersList = reminderList
      .filter((r: any) => r.status === 'pending' && !isReminderOverdue(r))
      .sort((a: any, b: any) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    const pendingReminders = pendingRemindersList.length
    const dueTodayCount = pendingRemindersList.filter((r: any) => {
      const d = new Date(r.dueAt)
      return d >= todayStart && d <= todayEnd
    }).length

    // ── Interactions ──────────────────────────────────────────────────────────
    const interactionList = arr(2)
    const totalInteractions = total(2)

    // Scenario 29 — real server-side counts per interaction type
    // (interactionsApi.typeSummary()), not interactionList's own 100-row cap.
    const typeSummary = arr(6) as { interactionType: string; count: number }[]
    const typeGroups: Record<string, number> = {}
    typeSummary.forEach(({ interactionType, count }) => {
      const t = interactionType ?? 'other'
      typeGroups[t] = (typeGroups[t] ?? 0) + count
    })
    const interactionTypeChart = Object.entries(typeGroups)
      .map(([k, v]) => ({
        label: fmtStatus(k),
        value: v,
        color: INTERACTION_COLORS[k] ?? '#94a3b8',
        badge: String(v),
      }))
      .sort((a, b) => b.value - a.value)

    // ── Segments ──────────────────────────────────────────────────────────────
    const segList = arr(3)
    const totalSegments = segList.length

    setS({
      loaded: true,
      lastUpdated: new Date(),
      totalCustomers,
      activeCustomers,
      overdueReminders,
      pendingReminders,
      dueTodayCount,
      totalInteractions,
      totalSegments,
      customerSourceChart,
      interactionTypeChart,
      recentInteractions: [...interactionList]
        .sort(
          (a: any, b: any) =>
            new Date(b.occurredAt ?? b.createdAt).getTime() -
            new Date(a.occurredAt ?? a.createdAt).getTime()
        )
        .slice(0, 8),
      overdueRemindersList: overdueRemindersList.slice(0, 6),
      pendingRemindersList: pendingRemindersList.slice(0, 6),
      segmentsList: segList.slice(0, 6),
    })
    setSpinning(false)
  }, [])

  useEffect(() => {
    load()
    // Scenario 29 — this dashboard previously only ever fetched once on
    // mount plus a manual Refresh click (cross-cutting finding #1). Mirror
    // POS's own overview page (refetchInterval: 30_000 +
    // refetchOnWindowFocus: true), the working reference pattern already
    // established in this codebase.
    const interval = setInterval(load, 30_000)
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') load()
    }
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', load)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [load])

  const loading = !s.loaded

  return (
    <div className="min-h-full bg-zinc-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">CRM Intelligence</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {s.lastUpdated
                ? `Updated ${s.lastUpdated.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`
                : 'Loading…'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={spinning}
              className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-60 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${spinning ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-8 pb-6 space-y-6">
        {/* Module Navigation */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-orange-500" />
            <h2 className="text-base font-semibold text-gray-900">Module Navigation</h2>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {(
                [
                  { label: 'Customers', href: '/crm/customers', icon: Contact },
                  { label: 'Reminders', href: '/crm/reminders', icon: BellRing },
                  { label: 'Segments', href: '/crm/segments', icon: Layers },
                  { label: 'Settings', href: '/crm/settings', icon: Activity },
                ] as const
              ).map(({ label, href, icon: Icon }, i) => (
                <Link
                  key={i}
                  href={href}
                  className="flex items-center justify-center gap-2 rounded-lg border border-gray-100 bg-gray-50/50 px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 transition-all"
                >
                  <Icon className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Collections Calendar — lives only here now; the standalone
        /crm/collections-calendar page and its nav link were removed. */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-orange-500" />
            <h2 className="text-base font-semibold text-gray-900">Collections Calendar</h2>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <CollectionsCalendar compact />
          </div>
        </div>

        {/* Row 1: Customer & Activity KPIs */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-orange-500" />
            <h2 className="text-base font-semibold text-gray-900">Customers &amp; Activity</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Total Customers"
              value={loading ? '—' : fmtNum(s.totalCustomers)}
              sub={loading ? '' : `${s.activeCustomers} active`}
              icon={Contact}
              iconBg="bg-orange-500"
              href="/crm/customers"
              loading={loading}
            />
            <KpiCard
              label="Interactions"
              value={loading ? '—' : fmtNum(s.totalInteractions)}
              sub="Calls, emails, meetings"
              icon={Activity}
              iconBg="bg-sky-500"
              href="/crm/customers"
              loading={loading}
            />
            <KpiCard
              label="Overdue Reminders"
              value={loading ? '—' : fmtNum(s.overdueReminders)}
              sub="Past due date"
              icon={AlertTriangle}
              iconBg="bg-red-500"
              href="/crm/reminders"
              loading={loading}
              urgent={s.overdueReminders > 0}
            />
            <KpiCard
              label="Due Today"
              value={loading ? '—' : fmtNum(s.dueTodayCount)}
              sub="Pending reminders today"
              icon={BellRing}
              iconBg="bg-amber-500"
              href="/crm/reminders"
              loading={loading}
              urgent={s.dueTodayCount > 0}
            />
          </div>
        </div>

        {/* Alert panels: Overdue reminders + Upcoming reminders + Segments —
        placed right after the KPI rows since these are the most
        time-sensitive/actionable items on the dashboard, not something to
        bury below the tables and charts. */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            <h2 className="text-base font-semibold text-gray-900">Alerts &amp; Risk Signals</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-red-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  Overdue Reminders
                </h3>
                <Link href="/crm/reminders" className="text-xs text-red-600 hover:underline">
                  {loading ? '…' : s.overdueReminders} total
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Sk key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : s.overdueRemindersList.length === 0 ? (
                <EmptyState message="No overdue reminders" />
              ) : (
                <div className="space-y-2">
                  {s.overdueRemindersList.map((r: any, i: number) => {
                    const target = reminderTarget(r)
                    return (
                      <div
                        key={r.id ?? i}
                        className="rounded-lg border border-red-100 bg-red-50 p-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${reminderStatusCls(r.status)}`}
                          >
                            {fmtStatus(r.reminderType ?? r.status)}
                          </span>
                          <span className="text-[10px] text-red-600 font-medium">
                            Due {fmtDateShort(r.dueAt)}
                          </span>
                        </div>
                        {target && (
                          <Link
                            href={target.href}
                            className="mt-1 block truncate text-[11px] font-semibold text-gray-800 hover:underline"
                          >
                            {target.label}
                          </Link>
                        )}
                        {r.note && (
                          <p className="text-[10px] text-gray-600 mt-0.5 truncate">{r.note}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-amber-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Upcoming Reminders
                </h3>
                <Link href="/crm/reminders" className="text-xs text-amber-600 hover:underline">
                  {loading ? '…' : s.pendingReminders} pending
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Sk key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : s.pendingRemindersList.length === 0 ? (
                <EmptyState message="No upcoming reminders" />
              ) : (
                <div className="space-y-2">
                  {s.pendingRemindersList.map((r: any, i: number) => {
                    const target = reminderTarget(r)
                    return (
                      <div
                        key={r.id ?? i}
                        className="rounded-lg border border-amber-100 bg-amber-50 p-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full capitalize">
                            {r.reminderType ?? 'reminder'}
                          </span>
                          <span className="text-[10px] text-amber-700 font-medium">
                            {fmtDateTime(r.dueAt)}
                          </span>
                        </div>
                        {target && (
                          <Link
                            href={target.href}
                            className="mt-1 block truncate text-[11px] font-semibold text-gray-800 hover:underline"
                          >
                            {target.label}
                          </Link>
                        )}
                        {r.note && (
                          <p className="text-[10px] text-gray-600 mt-0.5 truncate">{r.note}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-violet-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-bold text-violet-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="h-3 w-3" />
                  Customer Segments
                </h3>
                <Link href="/crm/segments" className="text-xs text-violet-600 hover:underline">
                  {loading ? '…' : `${s.totalSegments} segments`}
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Sk key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : s.segmentsList.length === 0 ? (
                <EmptyState message="No segments created yet" />
              ) : (
                <div className="space-y-2">
                  {s.segmentsList.map((seg: any, i: number) => (
                    <div
                      key={seg.id ?? i}
                      className="rounded-lg border border-violet-100 bg-violet-50 p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-900 truncate">{seg.name}</p>
                        <span className="shrink-0 text-xs font-bold text-violet-700 tabular-nums">
                          {fmtNum(Number(seg.memberCount))} members
                        </span>
                      </div>
                      {seg.description && (
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                          {seg.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Secondary strip */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-orange-500" />
            <h2 className="text-base font-semibold text-gray-900">Quick Stats</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            {(
              [
                {
                  label: 'Pending Reminders',
                  val: s.pendingReminders,
                  href: '/crm/reminders',
                  accent: 'text-amber-700',
                  bg: 'bg-amber-50 border-amber-100',
                },
                {
                  label: 'Segments',
                  val: s.totalSegments,
                  href: '/crm/segments',
                  accent: 'text-violet-700',
                  bg: 'bg-violet-50 border-violet-100',
                },
              ] as const
            ).map((m, i) => (
              <Link
                key={i}
                href={m.href}
                className={`rounded-xl border px-4 py-3 flex items-center justify-between hover:shadow-sm transition-all ${m.bg}`}
              >
                <span className="text-xs text-gray-600 font-medium">{m.label}</span>
                <span className={`text-sm font-bold tabular-nums ${m.accent}`}>
                  {loading ? '—' : fmtNum(m.val)}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Analysis: Customer sources HBar */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <PieChart className="h-4 w-4 text-orange-500" />
            <h2 className="text-base font-semibold text-gray-900">Customer Analytics</h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Customer Sources</h2>
                  <p className="text-xs text-gray-400">How customers were acquired</p>
                </div>
                <Link
                  href="/crm/customers"
                  className="flex items-center gap-0.5 text-xs text-orange-600 hover:text-orange-700"
                >
                  All <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <Sk key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : s.customerSourceChart.length === 0 ? (
                <EmptyState message="No customer data available" />
              ) : (
                <HBarChart items={s.customerSourceChart} />
              )}
            </div>
          </div>
        </div>

        {/* Interaction type breakdown */}
        {(loading || s.interactionTypeChart.length > 0) && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Interactions by Type</h2>
                <p className="text-xs text-gray-400">Calls, emails, meetings, and more</p>
              </div>
              <span className="text-xs text-gray-400">
                {loading ? '…' : `${fmtNum(s.totalInteractions)} total`}
              </span>
            </div>
            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[...Array(6)].map((_, i) => (
                  <Sk key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {s.interactionTypeChart.map((item, i) => {
                  const Icon = interactionIcon(item.label.toLowerCase())
                  return (
                    <div
                      key={i}
                      className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center"
                    >
                      <div className="flex justify-center mb-2">
                        <div
                          className="h-8 w-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: item.color + '20' }}
                        >
                          <Icon className="h-4 w-4" style={{ color: item.color }} />
                        </div>
                      </div>
                      <p className="text-lg font-bold text-gray-900 tabular-nums">{item.value}</p>
                      <p className="text-[10px] text-gray-500 capitalize">{item.label}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Tables: Recent Interactions */}
        <div className="grid grid-cols-1 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Recent Interactions</h2>
              <span className="text-xs text-gray-400">
                {loading ? '…' : `${fmtNum(s.totalInteractions)} total`}
              </span>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Sk key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : s.recentInteractions.length === 0 ? (
              <EmptyState message="No interactions logged yet" />
            ) : (
              <div className="space-y-2">
                {s.recentInteractions.map((interaction: any, i: number) => {
                  const color = INTERACTION_COLORS[interaction.interactionType] ?? '#94a3b8'
                  const Icon = interactionIcon(interaction.interactionType)
                  return (
                    <div
                      key={interaction.id ?? i}
                      className="flex items-start gap-2.5 rounded-lg border border-gray-100 bg-gray-50 p-2.5"
                    >
                      <div
                        className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center mt-0.5"
                        style={{ backgroundColor: color + '20' }}
                      >
                        <Icon className="h-3.5 w-3.5" style={{ color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-900 truncate">
                          {interaction.summary}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {fmtStatus(interaction.interactionType)} ·{' '}
                          {fmtDateTime(interaction.occurredAt)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
