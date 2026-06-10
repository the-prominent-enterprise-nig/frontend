'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getAttendanceChangeRequests } from '../_actions'
import type { CorrectionRequest } from '../_actions'

const issueTypeOptions = [
  'All Issues',
  'Missed clock-in/out',
  'Wrong time',
  'Wrong status',
  'Other',
]

function inferIssueType(request: CorrectionRequest) {
  const reason = (request.reason ?? '').toLowerCase()
  const hasStart = Boolean(request.requestedStart)
  const hasEnd = Boolean(request.requestedEnd)

  if (reason.includes('status')) return 'Wrong status'
  if (reason.includes('time') || (hasStart && hasEnd)) return 'Wrong time'
  if (reason.includes('clock')) return 'Missed clock-in/out'
  if (hasStart || hasEnd) return 'Missed clock-in/out'
  return 'Other'
}

export default function AttendanceChangeRequestsPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [issueTypeFilter, setIssueTypeFilter] = useState('All Issues')

  const { data: requests = [], isLoading } = useQuery<CorrectionRequest[]>({
    queryKey: ['attendance-change-requests'],
    queryFn: () => getAttendanceChangeRequests(),
  })

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const fullName = `${request.employee.firstName} ${request.employee.lastName}`
      const issueType = inferIssueType(request)
      const matchesSearch =
        fullName.toLowerCase().includes(search.toLowerCase()) ||
        (request.reason ?? '').toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'All Status' || request.status === statusFilter
      const matchesIssueType = issueTypeFilter === 'All Issues' || issueType === issueTypeFilter

      return matchesSearch && matchesStatus && matchesIssueType
    })
  }, [requests, search, statusFilter, issueTypeFilter])

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
              <h1 className="text-2xl font-semibold text-zinc-900">Attendance Change Requests</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                Employees can request fixes for missed, incorrect, or incomplete attendance records.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
              Submissions and approvals use the existing correction request backend. Expanded
              self-service forms are coming soon.
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <input
              type="text"
              placeholder="Search employee or reason..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 lg:max-w-sm"
            />

            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={issueTypeFilter}
                onChange={(event) => setIssueTypeFilter(event.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              >
                {issueTypeOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              >
                <option>All Status</option>
                <option>Pending</option>
                <option>Approved</option>
                <option>Rejected</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-100 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Requester</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Issue Type</th>
                  <th className="px-4 py-3 text-left font-medium">Requested Fix</th>
                  <th className="px-4 py-3 text-left font-medium">Reason</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                      Loading...
                    </td>
                  </tr>
                ) : filteredRequests.length > 0 ? (
                  filteredRequests.map((request) => {
                    const requestedStart = request.requestedStart ?? '--'
                    const requestedEnd = request.requestedEnd ?? '--'
                    const statusClass =
                      request.status === 'Approved'
                        ? 'bg-green-100 text-green-700'
                        : request.status === 'Pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'

                    return (
                      <tr key={request.id} className="border-t border-zinc-200 hover:bg-zinc-50">
                        <td className="px-4 py-3 font-medium text-zinc-900">
                          {request.employee.firstName} {request.employee.lastName}
                        </td>
                        <td className="px-4 py-3 text-zinc-700">{request.date.slice(0, 10)}</td>
                        <td className="px-4 py-3 text-zinc-700">{inferIssueType(request)}</td>
                        <td className="px-4 py-3 text-zinc-700">
                          {requestedStart} - {requestedEnd}
                        </td>
                        <td className="px-4 py-3 text-zinc-700">{request.reason ?? '--'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass}`}
                          >
                            {request.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="mx-auto max-w-sm">
                        <p className="text-sm font-medium text-zinc-900">
                          No attendance change requests found.
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">
                          Requests for missed, incorrect, or incomplete attendance records will
                          appear here.
                        </p>
                      </div>
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
