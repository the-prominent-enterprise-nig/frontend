'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getAttendanceSummary } from '../_actions'
import type { AttendanceSummary } from '../_actions'

function formatCutoffPeriod(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
  return `${fmt(start)} - ${fmt(end)}`
}

export default function AttendanceSummaryPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Status')

  const { data: summaries = [], isLoading } = useQuery<AttendanceSummary[]>({
    queryKey: ['attendance-summary'],
    queryFn: () => getAttendanceSummary(),
  })

  const filteredSummaries = useMemo(() => {
    return summaries.filter((summary) => {
      const fullName = `${summary.employee.firstName} ${summary.employee.lastName}`
      const cutoffPeriod = formatCutoffPeriod(summary.cutoffStart, summary.cutoffEnd)
      const matchesSearch =
        fullName.toLowerCase().includes(search.toLowerCase()) ||
        cutoffPeriod.toLowerCase().includes(search.toLowerCase())

      const matchesStatus = statusFilter === 'All Status' || summary.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [summaries, search, statusFilter])

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <button
            type="button"
            onClick={() => router.push('/human-resource/attendance')}
            className="mb-4 inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Attendance
          </button>

          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-zinc-900">Attendance Summary</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                View summarized attendance records within a payroll cutoff or reporting period.
              </p>
            </div>

            <button
              type="button"
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Export Summary
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <input
              type="text"
              placeholder="Search employee or cutoff period..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 lg:max-w-sm"
            />

            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              >
                <option>All Status</option>
                <option>Draft</option>
                <option>Finalized</option>
              </select>

              <input
                type="date"
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-100 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Employee</th>
                  <th className="px-4 py-3 text-left font-medium">Cutoff Period</th>
                  <th className="px-4 py-3 text-left font-medium">Tracked Hours</th>
                  <th className="px-4 py-3 text-left font-medium">Days Worked</th>
                  <th className="px-4 py-3 text-left font-medium">Absences</th>
                  <th className="px-4 py-3 text-left font-medium">Tardiness</th>
                  <th className="px-4 py-3 text-left font-medium">Overtime</th>
                  <th className="px-4 py-3 text-left font-medium">Leave Days</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-zinc-500">
                      Loading...
                    </td>
                  </tr>
                ) : filteredSummaries.length > 0 ? (
                  filteredSummaries.map((summary) => (
                    <tr key={summary.id} className="border-t border-zinc-200 hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-900">{`${summary.employee.firstName} ${summary.employee.lastName}`}</td>
                      <td className="px-4 py-3 text-zinc-700">
                        {formatCutoffPeriod(summary.cutoffStart, summary.cutoffEnd)}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{summary.totalTrackedHours}</td>
                      <td className="px-4 py-3 text-zinc-700">{summary.totalDaysWorked}</td>
                      <td className="px-4 py-3 text-zinc-700">{summary.totalAbsences}</td>
                      <td className="px-4 py-3 text-zinc-700">{summary.totalTardiness}</td>
                      <td className="px-4 py-3 text-zinc-700">{summary.totalOvertimeHours}</td>
                      <td className="px-4 py-3 text-zinc-700">{summary.leaveDaysRecorded}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            summary.status === 'Finalized'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {summary.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-zinc-500">
                      No attendance summaries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
