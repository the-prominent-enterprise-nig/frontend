'use client'

import { useEffect, useState } from 'react'
import { useWidgetSize } from '../WidgetSizeContext'
import { api } from '@/src/libs/api/client'

type OvertimeRequest = {
  id: string
  date?: string | null
  totalHours?: number | null
  status?: string | null
  employee?: {
    firstName?: string | null
    lastName?: string | null
  } | null
}

const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-700',
}

const INITIALS = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
const titleCase = (value?: string | null) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : 'Pending'
const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(new Date(value))
    : 'No date'

export default function OvertimeRequestsWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'
  const [requests, setRequests] = useState<OvertimeRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadRequests() {
      setLoading(true)
      const result = await api.get<OvertimeRequest[]>('/attendance/overtime-requests')
      if (!active) return
      setRequests(result.data ?? [])
      setLoading(false)
    }

    loadRequests()

    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">
        Loading overtime requests...
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">
        No overtime requests yet.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {requests.slice(0, 4).map((req) => {
        const name =
          `${req.employee?.firstName ?? ''} ${req.employee?.lastName ?? ''}`.trim() ||
          'Unassigned employee'
        const status = titleCase(req.status)
        return (
          <div
            key={req.id}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 transition"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">
              {INITIALS(name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-900">{name}</p>
              {!isCompact && (
                <p className="text-[10px] text-zinc-500">
                  {formatDate(req.date)} · {Number(req.totalHours ?? 0)}h OT
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
