'use client'

import { FileCheck, Plane, Clock, AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useWidgetSize } from '../WidgetSizeContext'
import { api } from '@/src/libs/api/client'

type LeaveSummary = { pending?: number; pendingRequests?: number }
type StatusRecord = { status?: string | null }

export default function PendingRequestsWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs' || variant === 'sm'
  const [requests, setRequests] = useState([
    {
      label: 'Leave Requests',
      count: 0,
      icon: Plane,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      note: '',
    },
    {
      label: 'Overtime Requests',
      count: 0,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      note: '',
    },
    {
      label: 'Document Requests',
      count: 0,
      icon: FileCheck,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      note: 'Soon',
    },
    {
      label: 'Flagged Items',
      count: 0,
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      note: 'Soon',
    },
  ])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadCounts() {
      setLoading(true)
      const [leave, overtime] = await Promise.all([
        api.get<LeaveSummary>('/leave-management/summary'),
        api.get<StatusRecord[]>('/attendance/overtime-requests'),
      ])

      if (!active) return

      const pendingOvertime = (overtime.data ?? []).filter(
        (item) => String(item.status ?? '').toLowerCase() === 'pending'
      ).length

      setRequests([
        {
          label: 'Leave Requests',
          count: leave.data?.pending ?? leave.data?.pendingRequests ?? 0,
          icon: Plane,
          color: 'text-purple-600',
          bg: 'bg-purple-50',
          note: '',
        },
        {
          label: 'Overtime Requests',
          count: pendingOvertime,
          icon: Clock,
          color: 'text-amber-600',
          bg: 'bg-amber-50',
          note: '',
        },
        {
          label: 'Document Requests',
          count: 0,
          icon: FileCheck,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          note: 'Soon',
        },
        {
          label: 'Flagged Items',
          count: 0,
          icon: AlertCircle,
          color: 'text-red-600',
          bg: 'bg-red-50',
          note: 'Soon',
        },
      ])
      setLoading(false)
    }

    loadCounts()

    return () => {
      active = false
    }
  }, [])

  if (isCompact) {
    // Compact: simple list of count + label
    return (
      <div className="flex flex-col gap-1.5">
        {requests.map((req) => {
          const Icon = req.icon
          return (
            <div
              key={req.label}
              className="flex items-center gap-2.5 rounded-lg bg-zinc-50 px-2.5 py-2"
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${req.bg}`}
              >
                <Icon className={`h-3.5 w-3.5 ${req.color}`} />
              </div>
              <p className="min-w-0 flex-1 truncate text-xs text-zinc-700">{req.label}</p>
              <span className={`text-sm font-bold ${req.color}`}>
                {loading ? '...' : req.note || req.count}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {requests.map((req) => {
          const Icon = req.icon
          return (
            <div
              key={req.label}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-zinc-100 bg-zinc-50 p-2.5 text-center"
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${req.bg}`}>
                <Icon className={`h-4 w-4 ${req.color}`} />
              </div>
              <p className="text-xl font-bold text-zinc-900">
                {loading ? '...' : req.note || req.count}
              </p>
              <p className="text-[10px] leading-tight text-zinc-500">{req.label}</p>
            </div>
          )
        })}
      </div>
      <button className="w-full rounded-lg bg-purple-600 py-1.5 text-xs font-medium text-white transition hover:bg-purple-700">
        Review All
      </button>
    </div>
  )
}
