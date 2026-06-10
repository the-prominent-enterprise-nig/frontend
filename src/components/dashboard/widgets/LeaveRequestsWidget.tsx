'use client'

import { useEffect, useState } from 'react'
import { useWidgetSize } from '../WidgetSizeContext'
import { api } from '@/src/libs/api/client'

type LeaveRequest = {
  id: string
  employee?: { firstName?: string; lastName?: string }
  leaveType?: { name?: string }
  startDate?: string
  endDate?: string
  status?: string
}

const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-700',
}

function initials(first?: string, last?: string): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase()
}

function fmtDateRange(start?: string, end?: string): string {
  if (!start) return '—'
  const s = new Date(start)
  const e = end ? new Date(end) : null
  const fmt = (d: Date) => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  return e && e.getTime() !== s.getTime() ? `${fmt(s)}–${fmt(e)}` : fmt(s)
}

export default function LeaveRequestsWidget() {
  const { variant } = useWidgetSize()
  const limit = variant === 'xs' ? 3 : 5
  const showDates = variant !== 'xs'

  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .get<{ data?: LeaveRequest[] }>('/leave-management/requests', { limit: 5, status: 'Pending' })
      .then((res) => {
        if (cancelled) return
        setRequests(res.data?.data ?? [])
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col gap-0.5">
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            <div className="h-7 w-7 rounded-full bg-zinc-100 animate-pulse shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-2.5 w-24 rounded bg-zinc-100 animate-pulse" />
              <div className="h-2 w-32 rounded bg-zinc-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4 text-center">
        <p className="text-xs text-zinc-400">No pending leave requests</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {requests.slice(0, limit).map((req) => {
        const firstName = req.employee?.firstName
        const lastName = req.employee?.lastName
        const name = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown'
        const status = req.status ?? 'Pending'
        return (
          <div
            key={req.id}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 transition"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-700">
              {initials(firstName, lastName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-900">{name}</p>
              {showDates && (
                <p className="truncate text-[10px] text-zinc-500">
                  {req.leaveType?.name ?? 'Leave'} · {fmtDateRange(req.startDate, req.endDate)}
                </p>
              )}
            </div>
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLES[status] ?? 'bg-zinc-100 text-zinc-600'}`}
            >
              {status}
            </span>
          </div>
        )
      })}
    </div>
  )
}
