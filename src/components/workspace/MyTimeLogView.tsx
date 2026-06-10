'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, CheckCircle2, AlertCircle, CalendarDays, LogIn, LogOut } from 'lucide-react'
import {
  getActiveTimer,
  getMyTimeLogs,
  startTimer,
  stopTimer,
  type TimeLog,
} from '@/src/libs/actions/time-log.actions'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatMinutes(minutes: number) {
  if (minutes === 0) return '—'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ─── Attendance card ──────────────────────────────────────────────────────────

function AttendanceCard({
  timer,
  onTimeIn,
  onTimeOut,
  loading,
  error,
}: {
  timer: TimeLog | null | undefined
  onTimeIn: () => void
  onTimeOut: () => void
  loading: boolean
  error: string | null
}) {
  const isActive = timer?.status === 'running' || timer?.status === 'paused'
  const isCompleted = timer?.status === 'completed'

  let statusDot = <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
  let statusLabel = 'Not timed in'
  let statusClass = 'text-zinc-500'

  if (isActive) {
    statusDot = <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-500" />
    statusLabel = 'Clocked in'
    statusClass = 'text-green-700'
  } else if (isCompleted) {
    statusDot = <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
    statusLabel = 'Completed'
    statusClass = 'text-purple-700'
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          {statusDot}
          <span className={`text-sm font-semibold ${statusClass}`}>{statusLabel}</span>
        </div>
      </div>

      <div className="px-5 py-6 space-y-5">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Info grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-zinc-50 px-4 py-3">
            <p className="text-xs text-zinc-400">Time In</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">
              {timer ? formatTime(timer.startedAt) : '—'}
            </p>
          </div>
          <div className="rounded-lg bg-zinc-50 px-4 py-3">
            <p className="text-xs text-zinc-400">Time Out</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">
              {timer?.stoppedAt ? formatTime(timer.stoppedAt) : '—'}
            </p>
          </div>
          <div className="rounded-lg bg-zinc-50 px-4 py-3">
            <p className="text-xs text-zinc-400">Hours Worked</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">
              {timer ? formatMinutes(timer.totalWorkedMinutes) : '—'}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          {!isActive && !isCompleted && (
            <button
              onClick={onTimeIn}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-purple-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-800 disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" />
              Time In
            </button>
          )}

          {isActive && (
            <button
              onClick={onTimeOut}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-900 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              Time Out
            </button>
          )}

          {isCompleted && (
            <button
              onClick={onTimeIn}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" />
              Start New Session
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Log row ──────────────────────────────────────────────────────────────────

function LogRow({ log, showDate = false }: { log: TimeLog; showDate?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-50">
        <CheckCircle2 className="h-4 w-4 text-purple-600" />
      </div>
      <div className="min-w-0 flex-1">
        {showDate && <p className="text-xs font-medium text-zinc-500">{formatDate(log.date)}</p>}
        <p className="text-xs text-zinc-400">
          {formatTime(log.startedAt)}
          {log.stoppedAt ? ` → ${formatTime(log.stoppedAt)}` : ''}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-zinc-900">
          {formatMinutes(log.totalWorkedMinutes)} worked
        </p>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MyTimeLogView({ employeeName }: { employeeName: string }) {
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)

  const { data: activeTimer, isLoading: loadingActive } = useQuery({
    queryKey: ['time-log', 'active'],
    queryFn: getActiveTimer,
    staleTime: 0,
  })

  const { data: myLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['time-log', 'my-logs'],
    queryFn: getMyTimeLogs,
    staleTime: 10_000,
  })

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['time-log'] })
  }, [queryClient])

  const timeInMut = useMutation({
    mutationFn: async () => {
      const r = await startTimer()
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      setActionError(null)
      invalidate()
    },
    onError: (e: unknown) => {
      setActionError(e instanceof Error ? e.message : 'Failed to clock in. Please try again.')
    },
  })

  const timeOutMut = useMutation({
    mutationFn: async () => {
      const r = await stopTimer()
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      setActionError(null)
      invalidate()
    },
    onError: (e: unknown) => {
      setActionError(e instanceof Error ? e.message : 'Failed to clock out. Please try again.')
    },
  })

  const anyLoading = timeInMut.isPending || timeOutMut.isPending

  const today = new Date().toISOString().split('T')[0]
  const todayLogs = myLogs.filter((l) => l.date.split('T')[0] === today && l.status === 'completed')
  const recentLogs = myLogs
    .filter((l) => l.date.split('T')[0] !== today && l.status === 'completed')
    .slice(0, 14)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">My Time Log</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Record your attendance for today — {employeeName}
        </p>
      </div>

      {/* Attendance card */}
      {loadingActive ? (
        <div className="h-48 animate-pulse rounded-xl border border-zinc-200 bg-zinc-100" />
      ) : (
        <AttendanceCard
          timer={activeTimer}
          onTimeIn={() => timeInMut.mutate()}
          onTimeOut={() => timeOutMut.mutate()}
          loading={anyLoading}
          error={actionError}
        />
      )}

      {/* Today's logs */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-purple-500" />
            <h2 className="text-sm font-semibold text-zinc-900">Today&apos;s Completed Sessions</h2>
          </div>
        </div>
        {loadingLogs ? (
          <div className="divide-y divide-zinc-50">
            {[1, 2].map((i) => (
              <div key={i} className="px-5 py-4">
                <div className="h-4 w-48 animate-pulse rounded bg-zinc-200" />
              </div>
            ))}
          </div>
        ) : todayLogs.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <Clock className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
            <p className="text-sm text-zinc-400">No completed sessions today.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {todayLogs.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>

      {/* Recent logs */}
      {recentLogs.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-500" />
              <h2 className="text-sm font-semibold text-zinc-900">Recent Logs</h2>
            </div>
          </div>
          <div className="divide-y divide-zinc-50">
            {recentLogs.map((log) => (
              <LogRow key={log.id} log={log} showDate />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
