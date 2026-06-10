'use client'

import { useQuery } from '@tanstack/react-query'
import { Clock, CheckCircle2, AlertCircle, Pause, Play, Timer } from 'lucide-react'
import { getTimeLogs, type TimeLogEntry } from '../_actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TimeLogEntry['status'] }) {
  const map: Record<TimeLogEntry['status'], { label: string; icon: React.ReactNode; cls: string }> =
    {
      running: {
        label: 'Running',
        icon: <Play className="h-3 w-3" />,
        cls: 'bg-green-100 text-green-700',
      },
      paused: {
        label: 'Paused',
        icon: <Pause className="h-3 w-3" />,
        cls: 'bg-amber-100 text-amber-700',
      },
      completed: {
        label: 'Completed',
        icon: <CheckCircle2 className="h-3 w-3" />,
        cls: 'bg-purple-100 text-purple-700',
      },
      missing_stop: {
        label: 'Needs Review',
        icon: <AlertCircle className="h-3 w-3" />,
        cls: 'bg-red-100 text-red-700',
      },
    }
  const { label, icon, cls } = map[status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      {icon}
      {label}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HRTimeLogsPage() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['hr', 'time-logs'],
    queryFn: () => getTimeLogs(),
    staleTime: 30_000,
  })

  const running = logs.filter((l) => l.status === 'running' || l.status === 'paused')
  const completed = logs.filter((l) => l.status === 'completed' || l.status === 'missing_stop')

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
            <Timer className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900">Employee Time Logs</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              View all employee time logs across your enterprise.
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Active timers */}
        {running.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                <h2 className="text-sm font-semibold text-zinc-900">
                  Active Timers ({running.length})
                </h2>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="px-5 py-3">Employee</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Start</th>
                    <th className="px-5 py-3">Worked</th>
                    <th className="px-5 py-3">Paused</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {running.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-50">
                      <td className="px-5 py-3.5 font-medium text-zinc-900">
                        {log.employee.firstName} {log.employee.lastName}
                        <span className="ml-1.5 text-xs font-normal text-zinc-400">
                          {log.employee.employeeCode}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-500">{formatDate(log.date)}</td>
                      <td className="px-5 py-3.5 text-zinc-500">{formatTime(log.startedAt)}</td>
                      <td className="px-5 py-3.5 font-semibold text-zinc-900">
                        {formatMinutes(log.totalWorkedMinutes)}
                      </td>
                      <td className="px-5 py-3.5 text-zinc-500">
                        {log.totalPausedMinutes > 0 ? formatMinutes(log.totalPausedMinutes) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={log.status} />
                      </td>
                      <td className="px-5 py-3.5 capitalize text-zinc-500">{log.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* All logs */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-500" />
              <h2 className="text-sm font-semibold text-zinc-900">
                Completed Logs ({completed.length})
              </h2>
            </div>
          </div>

          {isLoading ? (
            <div className="divide-y divide-zinc-50">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="px-5 py-4">
                  <div className="h-4 w-full max-w-lg animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : completed.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Clock className="mx-auto mb-3 h-10 w-10 text-zinc-200" />
              <p className="text-sm font-medium text-zinc-500">No completed time logs yet.</p>
              <p className="mt-1 text-xs text-zinc-400">
                Logs will appear here once employees stop their timers.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="px-5 py-3">Employee</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Start</th>
                    <th className="px-5 py-3">Stop</th>
                    <th className="px-5 py-3">Worked</th>
                    <th className="px-5 py-3">Paused</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {completed.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-50">
                      <td className="px-5 py-3.5 font-medium text-zinc-900">
                        {log.employee.firstName} {log.employee.lastName}
                        <span className="ml-1.5 text-xs font-normal text-zinc-400">
                          {log.employee.employeeCode}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-500">{formatDate(log.date)}</td>
                      <td className="px-5 py-3.5 text-zinc-500">{formatTime(log.startedAt)}</td>
                      <td className="px-5 py-3.5 text-zinc-500">
                        {log.stoppedAt ? formatTime(log.stoppedAt) : '—'}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-zinc-900">
                        {formatMinutes(log.totalWorkedMinutes)}
                      </td>
                      <td className="px-5 py-3.5 text-zinc-500">
                        {log.totalPausedMinutes > 0 ? formatMinutes(log.totalPausedMinutes) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={log.status} />
                      </td>
                      <td className="px-5 py-3.5 capitalize text-zinc-500">{log.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
