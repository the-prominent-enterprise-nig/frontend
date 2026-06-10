'use client'

import { useEffect, useState } from 'react'
import { useWidgetSize } from '../WidgetSizeContext'
import { api } from '@/src/libs/api/client'

type PayslipRow = {
  id: string
  status?: string
  employee?: { firstName?: string; lastName?: string }
  netPay?: number | string | null
}

type PayrollPeriod = {
  id: string
  payslips?: PayslipRow[]
}

const STATUS_COLORS: Record<string, string> = {
  computed: 'bg-purple-500',
  approved: 'bg-blue-500',
  generated: 'bg-emerald-500',
  released: 'bg-amber-400',
}

export default function PayslipStatusWidget() {
  const { variant } = useWidgetSize()
  const showRecent = variant === 'lg'

  const [payslips, setPayslips] = useState<PayslipRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .get<PayrollPeriod[]>('/payroll/periods')
      .then((res) => {
        if (cancelled) return
        const latestPeriod = Array.isArray(res.data) && res.data.length > 0 ? res.data[0] : null
        setPayslips(latestPeriod?.payslips ?? [])
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
      <div className="flex flex-col gap-3">
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-5 rounded bg-zinc-100 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (payslips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center gap-1">
        <p className="text-xs font-medium text-zinc-600">No payslips generated</p>
        <p className="text-[10px] text-zinc-400">
          Generate payslips from a payroll period to see status here
        </p>
      </div>
    )
  }

  const total = payslips.length
  const byStatus = payslips.reduce<Record<string, number>>((acc, p) => {
    const s = (p.status ?? 'computed').toLowerCase()
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})

  const stages = [
    { label: 'Computed', key: 'computed' },
    { label: 'Approved', key: 'approved' },
    { label: 'Generated', key: 'generated' },
    { label: 'Released', key: 'released' },
  ].map((s) => ({
    ...s,
    count: byStatus[s.key] ?? 0,
    pct: total > 0 ? ((byStatus[s.key] ?? 0) / total) * 100 : 0,
    color: STATUS_COLORS[s.key] ?? 'bg-zinc-400',
  }))

  const recent = payslips.slice(0, 3)

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-2">
        {stages.map((stage) => (
          <div key={stage.label}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-zinc-700 truncate">{stage.label}</p>
              <p className="text-[10px] text-zinc-500 shrink-0 ml-1">
                {stage.count} ({Math.round(stage.pct)}%)
              </p>
            </div>
            <div className="h-1.5 w-full rounded-full bg-zinc-100">
              <div
                className={`h-1.5 rounded-full transition-all ${stage.color}`}
                style={{ width: `${stage.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {showRecent && recent.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 mb-1.5">
            Recent
          </p>
          {recent.map((r) => {
            const name =
              [r.employee?.firstName, r.employee?.lastName].filter(Boolean).join(' ') || 'Employee'
            const net = r.netPay != null ? `₱${Number(r.netPay).toLocaleString()}` : '—'
            const status = r.status ?? 'computed'
            return (
              <div
                key={r.id}
                className="flex items-center justify-between py-1.5 border-b border-zinc-100 last:border-0"
              >
                <p className="text-xs text-zinc-800 truncate">{name}</p>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <p className="text-xs font-semibold text-zinc-900">{net}</p>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${status === 'released' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
