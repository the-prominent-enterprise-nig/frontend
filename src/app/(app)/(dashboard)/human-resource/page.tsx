'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  Users,
  UserCheck,
  UserX,
  CalendarDays,
  Clock,
  RefreshCw,
  ArrowUpRight,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  FileText,
  DollarSign,
  TrendingUp,
  Activity,
  Shield,
  UserPlus,
  Receipt,
  CalendarClock,
  Briefcase,
  SunMedium,
  Timer,
  ClipboardList,
  Building,
} from 'lucide-react'
import { getEmployees } from './employees/_actions/get-employee-list'
import { getLeaveRequests, getLeaveTypes } from '@/src/libs/actions/leave.actions'
import { getPayrollPeriods } from './payroll/_actions/payroll-actions'
import { getPayslips } from './payslips/_actions/payslip-actions'
import {
  getAttendanceLogs,
  getOvertimeRequests,
  getCorrectionRequests,
  getAttendanceSummary,
} from './attendance/_actions/index'
import { getHolidays } from './holidays/_actions/holiday-actions'

// ── Utilities ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return '₱0'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}₱${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}₱${(abs / 1_000).toFixed(0)}K`
  return `${sign}₱${Math.round(abs).toLocaleString('en-PH')}`
}

function fmtNum(n: number) {
  if (!Number.isFinite(n)) return '0'
  return Math.round(n).toLocaleString('en-PH')
}

function fmtDate(dateStr?: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function fmtDateShort(dateStr?: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

// ── Status helpers ─────────────────────────────────────────────────────────────

function payrollStatusCls(status?: string) {
  const u = status?.toUpperCase()
  if (u === 'DRAFT') return 'bg-zinc-100 text-zinc-600'
  if (u === 'PENDING') return 'bg-amber-100 text-amber-700'
  if (u === 'APPROVED') return 'bg-emerald-100 text-emerald-700'
  if (u === 'REJECTED') return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

function leaveStatusCls(status?: string) {
  if (status === 'Pending') return 'bg-amber-100 text-amber-700'
  if (status === 'Approved') return 'bg-emerald-100 text-emerald-700'
  if (status === 'Rejected') return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

function holidayTypeCls(type?: string) {
  if (type === 'Regular') return 'bg-red-100 text-red-700'
  if (type === 'SpecialNonWorking') return 'bg-amber-100 text-amber-700'
  if (type === 'Company') return 'bg-purple-100 text-purple-700'
  if (type === 'Branch') return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-600'
}

// ── DonutChart ─────────────────────────────────────────────────────────────────

function DonutChart({
  segments,
  size = 148,
  stroke = 22,
}: {
  segments: { label: string; value: number; color: string }[]
  size?: number
  stroke?: number
}) {
  const tot = useMemo(() => segments.reduce((s, x) => s + x.value, 0), [segments])
  const r = (size - stroke) / 2
  const C = 2 * Math.PI * r
  const cx = size / 2
  let accum = 0
  const arcs = segments.map((seg) => {
    const pct = tot > 0 ? seg.value / tot : 0
    const len = pct * C
    const offset = -accum
    accum += len
    return { ...seg, pct, len, offset }
  })
  if (!segments.length || tot === 0) {
    return (
      <div className="flex h-[148px] items-center justify-center">
        <p className="text-xs text-gray-400 italic">No data available</p>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} className="shrink-0 -rotate-90">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {arcs.map((arc, i) =>
          arc.len > 0.5 ? (
            <circle
              key={i}
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth={stroke}
              strokeDasharray={`${arc.len} ${C}`}
              strokeDashoffset={arc.offset}
              style={{ transition: 'stroke-dasharray 0.7s ease-out' }}
            />
          ) : null
        )}
      </svg>
      <div className="min-w-0 flex-1 space-y-2">
        {arcs.map((arc, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            <div
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: arc.color }}
            />
            <span className="text-xs text-gray-600 truncate flex-1">{arc.label}</span>
            <span className="text-xs font-semibold text-gray-900 tabular-nums shrink-0">
              {(arc.pct * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── HBarChart ──────────────────────────────────────────────────────────────────

function HBarChart({
  items,
  moneyBars = false,
}: {
  items: { label: string; value: number; color: string; badge?: string }[]
  moneyBars?: boolean
}) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1 gap-2">
            <span className="text-xs text-gray-600 truncate">{item.label}</span>
            <div className="shrink-0 flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-900 tabular-nums">
                {moneyBars ? fmtMoney(item.value) : fmtNum(item.value)}
              </span>
              {item.badge && <span className="text-xs text-gray-400">{item.badge}</span>}
            </div>
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

// ── KpiCard ────────────────────────────────────────────────────────────────────

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
      ${href ? 'hover:border-purple-200 hover:shadow-md transition-all cursor-pointer' : ''}
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

// ── Micro-components ───────────────────────────────────────────────────────────

function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className ?? ''}`} />
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-7 text-center gap-2">
      <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
        <CheckCircle2 className="h-4 w-4 text-purple-600" />
      </div>
      <p className="text-xs text-gray-500">{message}</p>
    </div>
  )
}

// ── Initial state ──────────────────────────────────────────────────────────────

const INIT = {
  loaded: false,
  lastUpdated: null as Date | null,
  // Workforce
  totalEmployees: 0,
  activeEmployees: 0,
  inactiveEmployees: 0,
  // Leave
  pendingLeave: 0,
  onLeaveToday: 0,
  approvedThisMonth: 0,
  // Payroll
  draftPeriods: 0,
  pendingPeriods: 0,
  approvedPeriods: 0,
  totalNetPay: 0,
  totalPayslips: 0,
  latestPeriod: null as any,
  // Attendance
  totalAttendanceLogs: 0,
  pendingOvertimeRequests: 0,
  pendingCorrectionRequests: 0,
  totalAbsences: 0,
  totalOvertimeHours: 0,
  // Holidays
  upcomingHolidaysCount: 0,
  nextHoliday: null as any,
  // Charts
  leaveStatusChart: [] as any[],
  payrollChart: [] as any[],
  empStatusChart: [] as any[],
  // Tables
  recentLeave: [] as any[],
  recentPayroll: [] as any[],
  // Alerts
  pendingLeaveList: [] as any[],
  pendingOvertimeList: [] as any[],
  pendingCorrectionList: [] as any[],
  upcomingHolidaysList: [] as any[],
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function HumanResourcePage() {
  const [s, setS] = useState(INIT)
  const [spinning, setSpinning] = useState(false)

  const load = useCallback(async () => {
    setSpinning(true)

    const settled = await Promise.allSettled([
      getEmployees({ limit: 200 }), // 0
      getLeaveRequests(), // 1
      getPayrollPeriods(), // 2
      getPayslips(), // 3
      getAttendanceLogs(), // 4
      getOvertimeRequests(), // 5
      getCorrectionRequests(), // 6
      getAttendanceSummary(), // 7
      getHolidays({ year: new Date().getFullYear() }), // 8
      getLeaveTypes(), // 9
    ])

    function pick(i: number): any {
      const r = settled[i]
      if (r.status === 'rejected') return null
      const v = r.value
      if (v == null) return null
      if (Array.isArray(v)) return v
      if (v.success === false) return null
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

    // ── Employees ────────────────────────────────────────────────────────────
    const totalEmployees = total(0)
    const activeEmployees = arr(0).filter((e: any) => e.status === 'active').length
    const inactiveEmployees = totalEmployees - activeEmployees

    // ── Leave ─────────────────────────────────────────────────────────────────
    const leaveList = arr(1)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59)
    const pendingLeave = leaveList.filter((l: any) => l.status === 'Pending').length
    const onLeaveToday = leaveList.filter((l: any) => {
      if (l.status !== 'Approved') return false
      const s2 = new Date(l.startDate)
      s2.setHours(0, 0, 0, 0)
      const e2 = new Date(l.endDate)
      e2.setHours(23, 59, 59)
      return s2 <= today && e2 >= today
    }).length
    const approvedThisMonth = leaveList.filter((l: any) => {
      if (l.status !== 'Approved') return false
      const s2 = new Date(l.startDate)
      const e2 = new Date(l.endDate)
      return s2 <= monthEnd && e2 >= monthStart
    }).length

    const leaveByStatus = { Pending: 0, Approved: 0, Rejected: 0 }
    leaveList.forEach((l: any) => {
      if (l.status in leaveByStatus) leaveByStatus[l.status as keyof typeof leaveByStatus]++
    })
    const leaveStatusChart = [
      { label: 'Pending', value: leaveByStatus.Pending, color: '#f59e0b' },
      { label: 'Approved', value: leaveByStatus.Approved, color: '#10b981' },
      { label: 'Rejected', value: leaveByStatus.Rejected, color: '#ef4444' },
    ].filter((s2) => s2.value > 0)

    // ── Payroll ───────────────────────────────────────────────────────────────
    const payrollList = arr(2).sort(
      (a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    )
    const latestPeriod = payrollList[0] ?? null
    const draftPeriods = payrollList.filter((p: any) => p.status === 'DRAFT').length
    const pendingPeriods = payrollList.filter((p: any) => p.status === 'PENDING').length
    const approvedPeriods = payrollList.filter((p: any) => p.status === 'APPROVED').length
    const totalNetPay = latestPeriod ? Number(latestPeriod.totalNetPay) : 0
    const payrollChart = payrollList.slice(0, 5).map((p: any, i: number) => ({
      label: `${fmtDateShort(p.startDate)} – ${fmtDateShort(p.endDate)}`,
      value: Number(p.totalNetPay),
      color: (['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'] as string[])[i] ?? '#94a3b8',
      badge: fmtMoney(Number(p.totalNetPay)),
    }))

    // ── Payslips ──────────────────────────────────────────────────────────────
    const payslipList = arr(3)
    const totalPayslips = payslipList.length

    // ── Attendance ────────────────────────────────────────────────────────────
    const attendanceLogs = arr(4)
    const overtimeList = arr(5)
    const correctionList = arr(6)
    const summaryList = arr(7)
    const pendingOvertimeRequests = overtimeList.filter(
      (o: any) => o.status === 'PENDING' || o.status === 'Pending' || o.status === 'pending'
    ).length
    const pendingCorrectionRequests = correctionList.filter(
      (c: any) => c.status === 'PENDING' || c.status === 'Pending' || c.status === 'pending'
    ).length
    const totalAbsences = summaryList.reduce(
      (sum: number, s2: any) => sum + (Number(s2.totalAbsences) || 0),
      0
    )
    const totalOvertimeHours = summaryList.reduce(
      (sum: number, s2: any) => sum + (Number(s2.totalOvertimeHours) || 0),
      0
    )

    // ── Holidays ──────────────────────────────────────────────────────────────
    const holidayList = arr(8)
    const upcomingHolidays = holidayList
      .filter((h: any) => h.isActive && new Date(h.date) >= today)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const upcomingHolidaysCount = upcomingHolidays.length
    const nextHoliday = upcomingHolidays[0] ?? null

    // ── Employee status chart ─────────────────────────────────────────────────
    const empStatusGroups: Record<string, number> = {}
    arr(0).forEach((e: any) => {
      empStatusGroups[e.status] = (empStatusGroups[e.status] ?? 0) + 1
    })
    const empStatusChart = Object.entries(empStatusGroups)
      .map(([k, v], i) => ({
        label: k.charAt(0).toUpperCase() + k.slice(1),
        value: v,
        color:
          (
            {
              active: '#10b981',
              inactive: '#94a3b8',
              resigned: '#f59e0b',
              terminated: '#ef4444',
            } as any
          )[k] ?? '#7c3aed',
        badge: String(v),
      }))
      .sort((a, b) => b.value - a.value)

    setS({
      loaded: true,
      lastUpdated: new Date(),
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      pendingLeave,
      onLeaveToday,
      approvedThisMonth,
      draftPeriods,
      pendingPeriods,
      approvedPeriods,
      totalNetPay,
      totalPayslips,
      latestPeriod,
      totalAttendanceLogs: attendanceLogs.length,
      pendingOvertimeRequests,
      pendingCorrectionRequests,
      totalAbsences,
      totalOvertimeHours,
      upcomingHolidaysCount,
      nextHoliday,
      leaveStatusChart,
      payrollChart,
      empStatusChart,
      recentLeave: leaveList.slice(0, 8),
      recentPayroll: payrollList.slice(0, 8),
      pendingLeaveList: leaveList.filter((l: any) => l.status === 'Pending').slice(0, 6),
      pendingOvertimeList: overtimeList
        .filter(
          (o: any) => o.status === 'PENDING' || o.status === 'Pending' || o.status === 'pending'
        )
        .slice(0, 6),
      pendingCorrectionList: correctionList
        .filter(
          (c: any) => c.status === 'PENDING' || c.status === 'Pending' || c.status === 'pending'
        )
        .slice(0, 6),
      upcomingHolidaysList: upcomingHolidays.slice(0, 6),
    })
    setSpinning(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const loading = !s.loaded

  return (
    <div className="min-h-full bg-zinc-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">HR &amp; Payroll Intelligence</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {s.lastUpdated
                ? `Updated ${s.lastUpdated.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`
                : 'Loading…'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/human-resource/employees/new"
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5 text-gray-500" />
              Add Employee
            </Link>
            <Link
              href="/human-resource/payroll/new"
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Receipt className="h-3.5 w-3.5 text-gray-500" />
              New Payroll
            </Link>
            <button
              onClick={load}
              disabled={spinning}
              className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-60 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${spinning ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* Row 1: Workforce KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Total Employees"
            value={loading ? '—' : fmtNum(s.totalEmployees)}
            sub={loading ? '' : `${s.activeEmployees} active · ${s.inactiveEmployees} inactive`}
            icon={Users}
            iconBg="bg-purple-600"
            href="/human-resource/employees"
            loading={loading}
          />
          <KpiCard
            label="Active Employees"
            value={loading ? '—' : fmtNum(s.activeEmployees)}
            sub="Currently employed"
            icon={UserCheck}
            iconBg="bg-emerald-500"
            href="/human-resource/employees"
            loading={loading}
          />
          <KpiCard
            label="On Leave Today"
            value={loading ? '—' : fmtNum(s.onLeaveToday)}
            sub="Approved leave today"
            icon={CalendarDays}
            iconBg="bg-amber-500"
            href="/human-resource/leave"
            loading={loading}
            urgent={!loading && s.onLeaveToday > 0}
          />
          <KpiCard
            label="Pending Leave Requests"
            value={loading ? '—' : fmtNum(s.pendingLeave)}
            sub="Awaiting approval"
            icon={AlertTriangle}
            iconBg="bg-orange-500"
            href="/human-resource/leave"
            loading={loading}
            urgent={!loading && s.pendingLeave > 0}
          />
        </div>

        {/* Row 2: Attendance KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Attendance Logs"
            value={loading ? '—' : fmtNum(s.totalAttendanceLogs)}
            sub="Total recorded entries"
            icon={Clock}
            iconBg="bg-sky-500"
            href="/human-resource/attendance/logs"
            loading={loading}
          />
          <KpiCard
            label="Pending Overtime"
            value={loading ? '—' : fmtNum(s.pendingOvertimeRequests)}
            sub="Overtime requests pending"
            icon={Timer}
            iconBg="bg-indigo-500"
            href="/human-resource/attendance/overtime-request"
            loading={loading}
            urgent={!loading && s.pendingOvertimeRequests > 0}
          />
          <KpiCard
            label="Pending Change Requests"
            value={loading ? '—' : fmtNum(s.pendingCorrectionRequests)}
            sub="Attendance corrections pending"
            icon={ClipboardList}
            iconBg="bg-rose-500"
            href="/human-resource/attendance/change-requests"
            loading={loading}
            urgent={!loading && s.pendingCorrectionRequests > 0}
          />
          <KpiCard
            label="Total Overtime Hours"
            value={loading ? '—' : `${fmtNum(s.totalOvertimeHours)}h`}
            sub="Across all summaries"
            icon={Activity}
            iconBg="bg-cyan-500"
            href="/human-resource/attendance/summary"
            loading={loading}
          />
        </div>

        {/* Row 3: Payroll KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Latest Period Net Pay"
            value={loading ? '—' : fmtMoney(s.totalNetPay)}
            sub={
              loading
                ? ''
                : s.latestPeriod
                  ? `${fmtDateShort(s.latestPeriod.startDate)} – ${fmtDateShort(s.latestPeriod.endDate)}`
                  : 'No payroll periods'
            }
            icon={DollarSign}
            iconBg="bg-purple-600"
            href="/human-resource/payroll"
            loading={loading}
          />
          <KpiCard
            label="Approved This Month"
            value={loading ? '—' : fmtNum(s.approvedThisMonth)}
            sub="Approved leave this month"
            icon={CheckCircle2}
            iconBg="bg-teal-500"
            href="/human-resource/leave"
            loading={loading}
          />
          <KpiCard
            label="Total Payslips"
            value={loading ? '—' : fmtNum(s.totalPayslips)}
            sub="All generated payslips"
            icon={FileText}
            iconBg="bg-blue-500"
            href="/human-resource/payslips"
            loading={loading}
          />
          <KpiCard
            label="Upcoming Holidays"
            value={loading ? '—' : fmtNum(s.upcomingHolidaysCount)}
            sub={
              loading
                ? ''
                : s.nextHoliday
                  ? `Next: ${s.nextHoliday.name} · ${fmtDateShort(s.nextHoliday.date)}`
                  : 'No upcoming holidays'
            }
            icon={SunMedium}
            iconBg="bg-yellow-500"
            href="/human-resource/holidays"
            loading={loading}
          />
        </div>

        {/* Secondary strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              {
                label: 'Draft Payroll',
                val: s.draftPeriods,
                href: '/human-resource/payroll',
                accent: 'text-zinc-600',
                bg: 'bg-zinc-50 border-zinc-100',
              },
              {
                label: 'Pending Payroll',
                val: s.pendingPeriods,
                href: '/human-resource/payroll',
                accent: s.pendingPeriods > 0 ? 'text-amber-700' : 'text-gray-700',
                bg:
                  s.pendingPeriods > 0
                    ? 'bg-amber-50 border-amber-100'
                    : 'bg-gray-50 border-gray-100',
              },
              {
                label: 'Approved Payroll',
                val: s.approvedPeriods,
                href: '/human-resource/payroll',
                accent: 'text-emerald-700',
                bg: 'bg-emerald-50 border-emerald-100',
              },
              {
                label: 'Total Absences',
                val: s.totalAbsences,
                href: '/human-resource/attendance/summary',
                accent: s.totalAbsences > 0 ? 'text-red-700' : 'text-gray-700',
                bg: s.totalAbsences > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100',
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

        {/* Analysis charts: 3-col */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Leave Status Donut */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Leave Status</h2>
                <p className="text-xs text-gray-400">Pending / Approved / Rejected</p>
              </div>
              <Link
                href="/human-resource/leave"
                className="flex items-center gap-0.5 text-xs text-purple-600 hover:text-purple-700"
              >
                All <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {loading ? (
              <div className="flex items-center gap-6">
                <Sk className="h-[148px] w-[148px] rounded-full" />
                <div className="space-y-2.5 flex-1">
                  {[...Array(3)].map((_, i) => (
                    <Sk key={i} className="h-4 w-full" />
                  ))}
                </div>
              </div>
            ) : (
              <DonutChart segments={s.leaveStatusChart} />
            )}
          </div>

          {/* Payroll Periods HBar */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Payroll Periods</h2>
                <p className="text-xs text-gray-400">Net pay — last 5 periods</p>
              </div>
              <Link
                href="/human-resource/payroll"
                className="flex items-center gap-0.5 text-xs text-purple-600 hover:text-purple-700"
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
            ) : s.payrollChart.length === 0 ? (
              <EmptyState message="No payroll periods found" />
            ) : (
              <HBarChart items={s.payrollChart} moneyBars />
            )}
          </div>

          {/* Employee Status HBar */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Employee Status</h2>
                <p className="text-xs text-gray-400">Breakdown by employment status</p>
              </div>
              <Link
                href="/human-resource/employees"
                className="flex items-center gap-0.5 text-xs text-purple-600 hover:text-purple-700"
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
            ) : s.empStatusChart.length === 0 ? (
              <EmptyState message="No employee data found" />
            ) : (
              <HBarChart items={s.empStatusChart} />
            )}
          </div>
        </div>

        {/* Tables: Recent Leave + Recent Payroll */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Recent Leave Requests */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-purple-500" />
                  Recent Leave Requests
                </h3>
                <Link
                  href="/human-resource/leave"
                  className="flex items-center gap-0.5 text-xs text-purple-600 hover:text-purple-700"
                >
                  View all <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <Sk key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : s.recentLeave.length === 0 ? (
                <EmptyState message="No leave requests found" />
              ) : (
                <div className="space-y-1">
                  {s.recentLeave.map((leave: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-900 truncate">
                          {leave.employee
                            ? `${leave.employee.firstName ?? ''} ${leave.employee.lastName ?? ''}`.trim() ||
                              leave.employee.employeeCode
                            : (leave.employeeId ?? '—')}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {fmtDateShort(leave.startDate)} – {fmtDateShort(leave.endDate)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] font-medium rounded-full px-1.5 py-0.5 ${leaveStatusCls(leave.status)}`}
                      >
                        {leave.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Payroll Periods */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-purple-500" />
                  Recent Payroll Periods
                </h3>
                <Link
                  href="/human-resource/payroll"
                  className="flex items-center gap-0.5 text-xs text-purple-600 hover:text-purple-700"
                >
                  View all <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <Sk key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : s.recentPayroll.length === 0 ? (
                <EmptyState message="No payroll periods found" />
              ) : (
                <div className="space-y-1">
                  {s.recentPayroll.map((period: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-900 truncate">
                          {fmtDateShort(period.startDate)} – {fmtDateShort(period.endDate)}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {fmtNum(period.payslips?.length ?? 0)} payslips
                        </p>
                      </div>
                      <div className="shrink-0 text-right flex flex-col items-end gap-0.5">
                        <p className="text-xs font-bold text-gray-900 tabular-nums">
                          {fmtMoney(Number(period.totalNetPay) || 0)}
                        </p>
                        <span
                          className={`text-[10px] font-medium rounded-full px-1.5 py-0.5 ${payrollStatusCls(period.status)}`}
                        >
                          {period.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alert panels: 3-col */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-purple-500" />
            <h2 className="text-base font-semibold text-gray-900">
              Pending Actions &amp; Upcoming
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Pending Leave Approvals */}
            <div className="rounded-xl border border-amber-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  Pending Leave Approvals
                </h3>
                <Link
                  href="/human-resource/leave"
                  className="text-xs text-amber-600 hover:underline tabular-nums"
                >
                  {loading ? '…' : s.pendingLeave} total
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Sk key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : s.pendingLeaveList.length === 0 ? (
                <EmptyState message="No pending leave approvals" />
              ) : (
                <div className="space-y-2">
                  {s.pendingLeaveList.map((leave: any, i: number) => (
                    <div key={i} className="rounded-lg border border-amber-100 bg-amber-50 p-2.5">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {leave.employee
                          ? `${leave.employee.firstName ?? ''} ${leave.employee.lastName ?? ''}`.trim() ||
                            leave.employee.employeeCode
                          : (leave.employeeId ?? '—')}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {fmtDateShort(leave.startDate)} – {fmtDateShort(leave.endDate)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Overtime Requests */}
            <div className="rounded-xl border border-indigo-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                  Pending Overtime Requests
                </h3>
                <Link
                  href="/human-resource/attendance/overtime-request"
                  className="text-xs text-indigo-600 hover:underline tabular-nums"
                >
                  {loading ? '…' : s.pendingOvertimeRequests} total
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Sk key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : s.pendingOvertimeList.length === 0 ? (
                <EmptyState message="No pending overtime requests" />
              ) : (
                <div className="space-y-2">
                  {s.pendingOvertimeList.map((ot: any, i: number) => (
                    <div key={i} className="rounded-lg border border-indigo-100 bg-indigo-50 p-2.5">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {ot.employee
                          ? `${ot.employee.firstName ?? ''} ${ot.employee.lastName ?? ''}`.trim() ||
                            ot.employee.employeeCode
                          : (ot.employeeId ?? '—')}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {fmtDateShort(ot.date)} · {ot.totalHours ?? '—'}h
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming Holidays */}
            <div className="rounded-xl border border-purple-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-purple-500" />
                  Upcoming Holidays
                </h3>
                <Link
                  href="/human-resource/holidays"
                  className="text-xs text-purple-600 hover:underline tabular-nums"
                >
                  {loading ? '…' : s.upcomingHolidaysCount} total
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Sk key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : s.upcomingHolidaysList.length === 0 ? (
                <EmptyState message="No upcoming holidays" />
              ) : (
                <div className="space-y-2">
                  {s.upcomingHolidaysList.map((hol: any, i: number) => (
                    <div key={i} className="rounded-lg border border-purple-100 bg-purple-50 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-900 truncate">{hol.name}</p>
                        <span
                          className={`shrink-0 text-[10px] font-medium rounded-full px-1.5 py-0.5 ${holidayTypeCls(hol.type)}`}
                        >
                          {hol.type === 'SpecialNonWorking' ? 'Special' : (hol.type ?? 'Holiday')}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">{fmtDate(hol.date)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick navigation */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
            Module Navigation
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-8">
            {(
              [
                { label: 'Employees', href: '/human-resource/employees', icon: Users },
                { label: 'Attendance', href: '/human-resource/attendance/logs', icon: Clock },
                { label: 'Leave', href: '/human-resource/leave', icon: CalendarDays },
                { label: 'Payroll', href: '/human-resource/payroll', icon: DollarSign },
                { label: 'Payslips', href: '/human-resource/payslips', icon: FileText },
                { label: 'Holidays', href: '/human-resource/holidays', icon: SunMedium },
                {
                  label: 'Overtime',
                  href: '/human-resource/attendance/overtime-request',
                  icon: Timer,
                },
                { label: 'Settings', href: '/human-resource/settings', icon: Building },
              ] as const
            ).map(({ label, href, icon: Icon }, i) => (
              <Link
                key={i}
                href={href}
                className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2.5 text-xs font-medium text-gray-700 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-all"
              >
                <Icon className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
