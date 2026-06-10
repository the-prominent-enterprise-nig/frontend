'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  ClipboardList,
  Clock3,
  Tag,
  ChevronRight,
  BarChart2,
  FileEdit,
  CheckCircle2,
  Timer,
} from 'lucide-react'
import {
  getAttendanceLogs,
  getOvertimeRequests,
  getAttendanceChangeRequests,
  getStatusTypes,
  getAttendanceSummary,
} from './_actions'
import type {
  AttendanceLog,
  OvertimeRequest,
  CorrectionRequest,
  AttendanceStatusType,
  AttendanceSummary,
} from './_actions'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const STATUS_BADGE: Record<string, string> = {
  Present: 'bg-green-100 text-green-700',
  Late: 'bg-amber-100 text-amber-700',
  Absent: 'bg-red-100 text-red-700',
  'Half Day': 'bg-orange-100 text-orange-700',
  'On Leave': 'bg-blue-100 text-blue-700',
  'Official Business': 'bg-purple-100 text-purple-700',
  'Rest Day': 'bg-zinc-100 text-zinc-500',
  Holiday: 'bg-indigo-100 text-indigo-700',
  'Holiday Worked': 'bg-teal-100 text-teal-700',
  Undertime: 'bg-orange-100 text-orange-700',
  'Missing Clock Out': 'bg-red-50 text-red-500',
}

export default function AttendancePage() {
  const router = useRouter()
  const today = todayStr()

  const { data: logs = [], isLoading: logsLoading } = useQuery<AttendanceLog[]>({
    queryKey: ['attendance-logs'],
    queryFn: () => getAttendanceLogs(),
  })

  const { data: overtimeRequests = [], isLoading: otLoading } = useQuery<OvertimeRequest[]>({
    queryKey: ['overtime-requests'],
    queryFn: () => getOvertimeRequests(),
  })

  const { data: changeRequests = [], isLoading: crLoading } = useQuery<CorrectionRequest[]>({
    queryKey: ['attendance-change-requests'],
    queryFn: () => getAttendanceChangeRequests(),
  })

  const { data: statusTypes = [] } = useQuery<AttendanceStatusType[]>({
    queryKey: ['attendance-status-types'],
    queryFn: () => getStatusTypes(),
  })

  const { data: summaries = [] } = useQuery<AttendanceSummary[]>({
    queryKey: ['attendance-summary'],
    queryFn: () => getAttendanceSummary(),
  })

  const isLoading = logsLoading || otLoading || crLoading

  const todayLogs = useMemo(() => logs.filter((l) => l.date.startsWith(today)), [logs, today])

  const metrics = useMemo(() => {
    const presentToday = todayLogs.filter((l) => {
      const name = (l.statusType?.statusName ?? '').toLowerCase()
      return name.includes('present') && !name.includes('late')
    }).length
    const absentToday = todayLogs.filter((l) =>
      (l.statusType?.statusName ?? '').toLowerCase().includes('absent')
    ).length
    const lateToday = todayLogs.filter((l) =>
      (l.statusType?.statusName ?? '').toLowerCase().includes('late')
    ).length
    const onLeaveToday = todayLogs.filter((l) =>
      (l.statusType?.statusName ?? '').toLowerCase().includes('leave')
    ).length
    const pendingOvertime = overtimeRequests.filter((r) => r.status === 'PENDING').length
    const pendingChangeRequests = changeRequests.filter(
      (r) => (r.status ?? '').toLowerCase() === 'pending'
    ).length
    return {
      presentToday,
      absentToday,
      lateToday,
      onLeaveToday,
      pendingOvertime,
      pendingChangeRequests,
    }
  }, [todayLogs, overtimeRequests, changeRequests])

  const recentLogs = useMemo(
    () =>
      [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6),
    [logs]
  )

  const pendingOT = useMemo(
    () => overtimeRequests.filter((r) => r.status === 'PENDING').slice(0, 4),
    [overtimeRequests]
  )
  const pendingCR = useMemo(
    () => changeRequests.filter((r) => (r.status ?? '').toLowerCase() === 'pending').slice(0, 4),
    [changeRequests]
  )

  const activeStatusCount = statusTypes.filter((s) => s.isActive).length

  const tools = [
    {
      id: 'logs',
      label: 'Attendance Logs',
      description: 'Daily records and time entries',
      href: '/human-resource/attendance/logs',
      icon: ClipboardList,
      badge: logsLoading ? null : logs.length > 0 ? `${logs.length} records` : null,
    },
    {
      id: 'summary',
      label: 'Attendance Summary',
      description: 'Attendance totals for payroll and reports',
      href: '/human-resource/attendance/summary',
      icon: BarChart2,
      badge: logsLoading ? null : summaries.length > 0 ? `${summaries.length} entries` : null,
    },
    {
      id: 'status-type',
      label: 'Status Types',
      description: 'Attendance labels and payroll impact setup',
      href: '/human-resource/attendance/status-type',
      icon: Tag,
      badge: activeStatusCount > 0 ? `${activeStatusCount} active` : null,
    },
    {
      id: 'overtime-request',
      label: 'Overtime Requests',
      description: 'Review overtime requests',
      href: '/human-resource/attendance/overtime-request',
      icon: Clock3,
      badge: otLoading
        ? null
        : metrics.pendingOvertime > 0
          ? `${metrics.pendingOvertime} pending`
          : null,
      badgePending: !otLoading && metrics.pendingOvertime > 0,
    },
    {
      id: 'change-requests',
      label: 'Change Requests',
      description: 'Fix missed or incorrect attendance records',
      href: '/human-resource/attendance/change-requests',
      icon: FileEdit,
      badge: crLoading
        ? null
        : metrics.pendingChangeRequests > 0
          ? `${metrics.pendingChangeRequests} pending`
          : null,
      badgePending: !crLoading && metrics.pendingChangeRequests > 0,
    },
    {
      id: 'time-logs',
      label: 'Employee Time Logs',
      description: 'View work timer sessions from all employees',
      href: '/human-resource/attendance/time-logs',
      icon: Timer,
      badge: null,
      badgePending: false,
    },
  ]

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page Header — title only, no duplicate action buttons */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Attendance &amp; Time</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Track attendance logs, status types, overtime, and change requests.
          </p>
        </div>

        {/* Hero Card */}
        <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-purple-500">
                Timekeeping &amp; Attendance
              </p>
              <h2 className="mt-1.5 text-lg font-semibold text-zinc-900">
                Review today&#39;s attendance
              </h2>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                Monitor time logs, attendance status, overtime, and change requests in one place.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => router.push('/human-resource/attendance/logs')}
                className="rounded-lg bg-purple-700 px-5 py-2 text-sm font-medium text-white hover:bg-purple-800"
              >
                View Attendance Logs
              </button>
              <button
                type="button"
                onClick={() => router.push('/human-resource/attendance/change-requests')}
                className="rounded-lg border border-purple-200 bg-white px-5 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50"
              >
                Change Requests
              </button>
            </div>
          </div>
        </div>

        {/* Metric Cards — compact, minimal, colored dot as status indicator */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Present Today"
            value={isLoading ? null : String(metrics.presentToday)}
            dot="bg-green-400"
          />
          <StatCard
            label="Absent Today"
            value={isLoading ? null : String(metrics.absentToday)}
            dot="bg-red-400"
          />
          <StatCard
            label="Late Today"
            value={isLoading ? null : String(metrics.lateToday)}
            dot="bg-amber-400"
          />
          <StatCard
            label="On Leave Today"
            value={isLoading ? null : String(metrics.onLeaveToday)}
            dot="bg-blue-400"
          />
          <StatCard
            label="Pending Overtime"
            value={otLoading ? null : String(metrics.pendingOvertime)}
            dot="bg-purple-400"
          />
          <StatCard
            label="Pending Changes"
            value={crLoading ? null : String(metrics.pendingChangeRequests)}
            dot="bg-purple-400"
          />
        </div>

        {/* Attendance Tools — single panel, list rows, no chunky mini-cards */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-zinc-900">Attendance Tools</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Quick access to attendance records and management tools
            </p>
          </div>
          <div className="divide-y divide-zinc-50">
            {tools.map((tool) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => router.push(tool.href)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-zinc-50"
              >
                <tool.icon className="h-4 w-4 shrink-0 text-purple-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-800">{tool.label}</p>
                  <p className="truncate text-xs text-zinc-500">{tool.description}</p>
                </div>
                {tool.badge && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      tool.badgePending
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {tool.badge}
                  </span>
                )}
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-300" />
              </button>
            ))}
          </div>
        </div>

        {/* Recent Logs + Work Queue */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recent Attendance Logs */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Recent Attendance Logs
              </h2>
              <button
                type="button"
                onClick={() => router.push('/human-resource/attendance/logs')}
                className="text-xs font-medium text-purple-600 hover:underline"
              >
                View all
              </button>
            </div>
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              {logsLoading ? (
                <div className="space-y-3 p-5">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex animate-pulse items-center gap-3">
                      <div className="h-3 w-2/5 rounded bg-zinc-200" />
                      <div className="h-3 w-1/5 rounded bg-zinc-200" />
                      <div className="h-3 w-1/5 rounded bg-zinc-200" />
                    </div>
                  ))}
                </div>
              ) : recentLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-zinc-400">
                  <ClipboardList className="h-6 w-6" />
                  <p className="text-sm">No attendance logs yet</p>
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="border-b border-zinc-100 bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Employee
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {recentLogs.map((log) => {
                      const statusName = log.statusType?.statusName ?? '—'
                      const badgeClass = STATUS_BADGE[statusName] ?? 'bg-zinc-100 text-zinc-600'
                      return (
                        <tr key={log.id} className="hover:bg-zinc-50">
                          <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                            {log.employee.firstName} {log.employee.lastName}
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-500">
                            {new Date(log.date).toLocaleDateString('en-PH', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
                            >
                              {statusName}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Work Queue */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Work Queue
              </h2>
              <button
                type="button"
                onClick={() => router.push('/human-resource/attendance/overtime-request')}
                className="text-xs font-medium text-purple-600 hover:underline"
              >
                View all
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              {isLoading ? (
                <div className="space-y-3 p-5">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex animate-pulse items-center gap-3">
                      <div className="h-3.5 w-3.5 rounded bg-zinc-200" />
                      <div className="h-3 w-2/5 rounded bg-zinc-200" />
                      <div className="ml-auto h-5 w-14 rounded-full bg-zinc-100" />
                    </div>
                  ))}
                </div>
              ) : pendingOT.length === 0 && pendingCR.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-zinc-400">
                  <CheckCircle2 className="h-6 w-6 text-green-400" />
                  <p className="text-sm font-medium text-zinc-600">All caught up</p>
                  <p className="text-xs text-zinc-400">No pending overtime or change requests.</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-50">
                  {pendingOT.map((req) => (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => router.push('/human-resource/attendance/overtime-request')}
                      className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-zinc-50"
                    >
                      <Timer className="h-3.5 w-3.5 shrink-0 text-purple-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-900">
                          {req.employee.firstName} {req.employee.lastName}
                        </p>
                        <p className="text-xs text-zinc-500">Overtime &middot; {req.totalHours}h</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Pending
                      </span>
                    </button>
                  ))}
                  {pendingCR.map((req) => (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => router.push('/human-resource/attendance/change-requests')}
                      className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-zinc-50"
                    >
                      <FileEdit className="h-3.5 w-3.5 shrink-0 text-purple-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-900">
                          {req.employee.firstName} {req.employee.lastName}
                        </p>
                        <p className="text-xs text-zinc-500">
                          Change Request &middot; {req.date.slice(0, 10)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Pending
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, dot }: { label: string; value: string | null; dot: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3.5 shadow-sm">
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
        <p className="text-xs font-medium text-zinc-500">{label}</p>
      </div>
      {value === null ? (
        <div className="mt-2 h-6 w-10 animate-pulse rounded bg-zinc-200" />
      ) : (
        <p className="mt-2 text-2xl font-bold text-zinc-900">{value}</p>
      )}
    </div>
  )
}
