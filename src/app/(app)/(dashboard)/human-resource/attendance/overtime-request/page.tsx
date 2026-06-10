'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, Clock3 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import OvertimeRequestReviewModal from '@/src/components/human-resource/OvertimeRequestReviewModal'
import { getOvertimeRequests, updateOvertimeStatus } from '../_actions'
import type { OvertimeRequest } from '../_actions'

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export default function OvertimeRequestPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedRequest, setSelectedRequest] = useState<OvertimeRequest | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data: requests = [], isLoading } = useQuery<OvertimeRequest[]>({
    queryKey: ['overtime-requests'],
    queryFn: () => getOvertimeRequests(),
  })

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const fullName = `${req.employee.firstName} ${req.employee.lastName}`
      const matchesSearch =
        fullName.toLowerCase().includes(search.toLowerCase()) ||
        (req.reason ?? '').toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'All' || req.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [requests, search, statusFilter])

  const handleApprove = async (id: string) => {
    setActionError(null)
    const result = await updateOvertimeStatus(id, 'APPROVED')
    if (!result.success) {
      setActionError(result.error ?? 'Failed to approve request')
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['overtime-requests'] })
    setSelectedRequest(null)
  }

  const handleDecline = async (id: string) => {
    setActionError(null)
    const result = await updateOvertimeStatus(id, 'REJECTED')
    if (!result.success) {
      setActionError(result.error ?? 'Failed to reject request')
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['overtime-requests'] })
    setSelectedRequest(null)
  }

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
          <div className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-purple-600" />
            <h1 className="text-2xl font-semibold text-zinc-900">Overtime Requests</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Review and approve employee overtime requests before work is performed.
          </p>
          {actionError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionError}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Search by employee or reason…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-purple-400"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 outline-none focus:border-purple-400"
            >
              <option value="All">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
                <p className="mt-3 text-sm text-zinc-500">Loading overtime requests…</p>
              </div>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-12 text-center">
              <Clock3 className="mx-auto h-10 w-10 text-zinc-300" />
              <p className="mt-3 text-sm font-medium text-zinc-600">
                {requests.length === 0
                  ? 'No overtime requests yet'
                  : 'No requests match your filters'}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Overtime requests appear here when employees submit them for approval.
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
                      OT Hours
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                      Time Range
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                      Reason
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredRequests.map((req) => (
                    <tr
                      key={req.id}
                      className="cursor-pointer hover:bg-zinc-50 transition-colors"
                      onClick={() => {
                        setActionError(null)
                        setSelectedRequest(req)
                      }}
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-zinc-900">
                          {req.employee.firstName} {req.employee.lastName}
                        </p>
                        <p className="text-xs text-zinc-400">{req.employee.employeeCode}</p>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-700">
                        {new Date(req.date).toLocaleDateString('en-PH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-zinc-900">{req.totalHours}h</td>
                      <td className="px-5 py-3.5 font-mono text-zinc-600 text-xs">
                        {req.startTime} – {req.endTime}
                      </td>
                      <td className="px-5 py-3.5 text-zinc-500 max-w-xs truncate">
                        {req.reason ?? '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[req.status] ?? 'bg-zinc-100 text-zinc-600'}`}
                        >
                          {STATUS_LABEL[req.status] ?? req.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-zinc-100 px-5 py-3 text-xs text-zinc-400">
                {filteredRequests.length} of {requests.length} requests
              </div>
            </div>
          )}
        </div>
      </div>

      <OvertimeRequestReviewModal
        isOpen={!!selectedRequest}
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onApprove={handleApprove}
        onDecline={handleDecline}
      />
    </div>
  )
}
