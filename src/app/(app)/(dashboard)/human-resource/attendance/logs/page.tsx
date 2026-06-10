'use client'

import { ArrowLeft, ClipboardList, Play, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAttendanceLogs,
  getAttendanceSettings,
  processAttendance,
  updateAttendanceCutoff,
} from '../_actions'
import type { AttendanceLog } from '../_actions'

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  Present: 'bg-green-100 text-green-700',
  Late: 'bg-amber-100 text-amber-700',
  Absent: 'bg-red-100 text-red-600',
  'On Leave': 'bg-blue-100 text-blue-700',
  Holiday: 'bg-indigo-100 text-indigo-700',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
}

function fmtHours(hours: number | null | undefined) {
  if (!hours) return '—'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function fmt12(time: string) {
  const [h, m] = time.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

// ─── Process modal ────────────────────────────────────────────────────────────

function ProcessModal({
  open,
  onClose,
  defaultCutoff,
  onConfirm,
  isPending,
  result,
}: {
  open: boolean
  onClose: () => void
  defaultCutoff: string
  onConfirm: (date: string, cutoff: string) => void
  isPending: boolean
  result: { success: boolean; processed?: number; error?: string } | null
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [cutoff, setCutoff] = useState(defaultCutoff)

  useEffect(() => {
    setCutoff(defaultCutoff)
  }, [defaultCutoff])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-zinc-900">Process Today&apos;s Attendance</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Mark employees as Present, Late, or Absent based on their Time In records. Employees on
          approved leave are marked On Leave.
        </p>

        {result && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
              result.success
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {result.success ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>
              {result.success
                ? `Processed ${result.processed} employee${result.processed !== 1 ? 's' : ''} successfully.`
                : result.error}
            </span>
          </div>
        )}

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 outline-none focus:border-purple-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">
              On-time cutoff
              <span className="ml-1 font-normal text-zinc-400">
                (employees who time in after this are marked Late)
              </span>
            </label>
            <input
              type="time"
              value={cutoff}
              onChange={(e) => setCutoff(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 outline-none focus:border-purple-400"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {result?.success ? 'Done' : 'Cancel'}
          </button>
          {!result?.success && (
            <button
              onClick={() => onConfirm(date, cutoff)}
              disabled={isPending || !date || !cutoff}
              className="flex-1 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-60"
            >
              {isPending ? 'Processing…' : 'Process Attendance'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AttendanceLogsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [processResult, setProcessResult] = useState<{
    success: boolean
    processed?: number
    error?: string
  } | null>(null)

  const { data: logs = [], isLoading } = useQuery<AttendanceLog[]>({
    queryKey: ['attendance-logs'],
    queryFn: () => getAttendanceLogs(),
    staleTime: 5_000,
  })

  const { data: settings } = useQuery({
    queryKey: ['attendance-settings'],
    queryFn: getAttendanceSettings,
    staleTime: 60_000,
  })

  const processMut = useMutation({
    mutationFn: async ({ date, cutoff }: { date: string; cutoff: string }) => {
      // Save cutoff as new default
      await updateAttendanceCutoff(cutoff)
      return processAttendance(date, cutoff)
    },
    onSuccess: (result) => {
      if (result.success) {
        setProcessResult({ success: true, processed: result.data?.processed })
        queryClient.invalidateQueries({ queryKey: ['attendance-logs'] })
        queryClient.invalidateQueries({ queryKey: ['attendance-settings'] })
      } else {
        setProcessResult({ success: false, error: result.error })
      }
    },
    onError: (e: unknown) => {
      setProcessResult({
        success: false,
        error: e instanceof Error ? e.message : 'Something went wrong',
      })
    },
  })

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const fullName = `${log.employee.firstName} ${log.employee.lastName}`.toLowerCase()
      const matchesSearch =
        !search ||
        fullName.includes(search.toLowerCase()) ||
        log.employee.employeeCode.toLowerCase().includes(search.toLowerCase())
      const matchesDate = !dateFilter || log.date.startsWith(dateFilter)
      const matchesStatus = statusFilter === 'All' || log.statusType?.statusName === statusFilter
      return matchesSearch && matchesDate && matchesStatus
    })
  }, [logs, search, dateFilter, statusFilter])

  const cutoffDisplay = settings?.cutoffTime ? fmt12(settings.cutoffTime) : '10:00 AM'

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <button
            type="button"
            onClick={() => router.push('/human-resource/attendance')}
            className="mb-4 inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Attendance
          </button>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-purple-600" />
                <h1 className="text-2xl font-semibold text-zinc-900">Attendance Logs</h1>
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                Daily attendance records for all employees.
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setProcessResult(null)
                  setModalOpen(true)
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
              >
                <Play className="h-3.5 w-3.5" />
                Process Today&apos;s Attendance
              </button>
              <p className="text-xs text-zinc-400">
                On-time cutoff: <span className="font-medium text-zinc-600">{cutoffDisplay}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Search by name or employee code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-purple-400"
            />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 outline-none focus:border-purple-400"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 outline-none focus:border-purple-400"
            >
              <option value="All">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
              <option value="On Leave">On Leave</option>
              <option value="Holiday">Holiday</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
                <p className="mt-3 text-sm text-zinc-500">Loading attendance logs…</p>
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardList className="mx-auto h-10 w-10 text-zinc-300" />
              <p className="mt-3 text-sm font-medium text-zinc-600">
                {logs.length === 0
                  ? 'No attendance records yet.'
                  : 'No records match your filters.'}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {logs.length === 0
                  ? "Records appear here once employees time in, or after you run Process Today's Attendance."
                  : 'Try adjusting your search or filter criteria.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                      Employee
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                      Date
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                      Time In
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                      Time Out
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                      Hours Worked
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredLogs.map((log) => {
                    const statusName = log.statusType?.statusName ?? '—'
                    const badgeClass = STATUS_BADGE[statusName] ?? 'bg-zinc-100 text-zinc-600'
                    return (
                      <tr key={log.id} className="transition-colors hover:bg-zinc-50">
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-zinc-900">
                            {log.employee.firstName} {log.employee.lastName}
                          </p>
                          <p className="text-xs text-zinc-400">{log.employee.employeeCode}</p>
                        </td>
                        <td className="px-5 py-3.5 text-zinc-700">{fmtDate(log.date)}</td>
                        <td className="px-5 py-3.5 text-zinc-700">{fmtTime(log.startTime)}</td>
                        <td className="px-5 py-3.5 text-zinc-700">{fmtTime(log.endTime)}</td>
                        <td className="px-5 py-3.5 text-zinc-700">{fmtHours(log.totalHours)}</td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}
                          >
                            {statusName}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="border-t border-zinc-100 px-5 py-3 text-xs text-zinc-400">
                Showing {filteredLogs.length} of {logs.length} records
              </div>
            </div>
          )}
        </div>
      </div>

      <ProcessModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultCutoff={settings?.cutoffTime ?? '10:00'}
        onConfirm={(date, cutoff) => processMut.mutate({ date, cutoff })}
        isPending={processMut.isPending}
        result={processResult}
      />
    </div>
  )
}
