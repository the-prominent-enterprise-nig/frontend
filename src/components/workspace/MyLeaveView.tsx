'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, CheckCircle, XCircle, Clock, Ban } from 'lucide-react'
import { getLeaveBalance, getPersonalRequests } from '@/src/libs/actions/leave.actions'
import MyLeaveRequestModal from './MyLeaveRequestModal'

type LeaveBalance = {
  id: string
  leaveTypeId: string
  leaveType: { id: string; name: string; code: string }
  allocatedDays: number
  adjustedDays: number
  usedDays: number
  carryoverDays: number
  year: number
}

type LeaveRequest = {
  id: string
  leaveType: { id: string; name: string; code: string }
  startDate: string | Date
  endDate: string | Date
  totalDaysRequested: number
  chargeableLeaveDays: number
  status: string
  reason: string
  submittedDate: string | Date | null
  reviewedBy: string | null
  remarks: string | null
}

type Props = {
  employeeId: string
  employeeName: string
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  Pending: <Clock className="h-4 w-4 text-amber-500" />,
  Approved: <CheckCircle className="h-4 w-4 text-green-600" />,
  Rejected: <XCircle className="h-4 w-4 text-red-500" />,
  Cancelled: <Ban className="h-4 w-4 text-zinc-400" />,
}

const STATUS_COLOR: Record<string, string> = {
  Pending: 'bg-amber-50 text-amber-800 border-amber-200',
  Approved: 'bg-green-50 text-green-800 border-green-200',
  Rejected: 'bg-red-50 text-red-800 border-red-200',
  Cancelled: 'bg-zinc-50 text-zinc-600 border-zinc-200',
}

function fmt(date: string | Date) {
  return new Date(date).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function MyLeaveView({ employeeId, employeeName }: Props) {
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [balRes, reqRes] = await Promise.all([
        getLeaveBalance(employeeId),
        getPersonalRequests(employeeId),
      ])
      if (balRes.success) setBalances(balRes.data as LeaveBalance[])
      else setError(balRes.error ?? 'Failed to load balances')
      if (reqRes.success) setRequests(reqRes.data as LeaveRequest[])
    } catch {
      setError('Failed to load leave data')
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const year = new Date().getFullYear()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-zinc-500">Loading your leave data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">My Leave</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {employeeName} · {year}
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          <Plus className="h-4 w-4" />
          File Leave
        </button>
      </div>

      {/* Leave Balances */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Leave Balances — {year}
        </h2>
        {balances.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            No leave balances found for {year}.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {balances.map((b) => {
              const remaining = b.allocatedDays + b.carryoverDays + b.adjustedDays - b.usedDays
              const total = b.allocatedDays + b.carryoverDays + b.adjustedDays
              const pct = total > 0 ? Math.min(100, Math.round((b.usedDays / total) * 100)) : 0
              return (
                <div key={b.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-zinc-900">{b.leaveType.name}</p>
                      <p className="text-xs text-zinc-500">{b.leaveType.code}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-zinc-900">{remaining}</p>
                      <p className="text-xs text-zinc-500">days left</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-zinc-900 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs text-zinc-500">
                      <span>{b.usedDays} used</span>
                      <span>{total} total</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Leave Requests */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          My Requests
        </h2>
        {requests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            No leave requests yet. Use &ldquo;File Leave&rdquo; to submit one.
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-zinc-900">{r.leaveType.name}</p>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[r.status] ?? 'bg-zinc-50 text-zinc-600 border-zinc-200'}`}
                      >
                        {STATUS_ICON[r.status]}
                        {r.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-600">
                      {fmt(r.startDate)} – {fmt(r.endDate)}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {r.chargeableLeaveDays} chargeable day{r.chargeableLeaveDays !== 1 ? 's' : ''}
                      {r.totalDaysRequested !== r.chargeableLeaveDays && (
                        <span> ({r.totalDaysRequested} calendar)</span>
                      )}
                    </p>
                    {r.reason && (
                      <p className="mt-1.5 text-sm text-zinc-600 line-clamp-2">{r.reason}</p>
                    )}
                  </div>
                  {r.submittedDate && (
                    <p className="shrink-0 text-xs text-zinc-400">{fmt(r.submittedDate)}</p>
                  )}
                </div>
                {r.remarks && (
                  <div className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                    <span className="font-medium">Remarks:</span> {r.remarks}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <MyLeaveRequestModal
        isOpen={modalOpen}
        employeeId={employeeId}
        onClose={() => setModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  )
}
