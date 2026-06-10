'use client'

import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'
import { api } from '@/src/libs/api/client'

type PayslipRow = {
  employee?: {
    salary?: number | string | null
    allowance?: number | string | null
    loanDeduction?: number | string | null
  }
}

type PayrollPeriod = {
  id: string
  name?: string
  startDate?: string
  endDate?: string
  status?: string
  payslips?: PayslipRow[]
}

function fmtMoney(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '₱0'
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `₱${(n / 1_000).toFixed(1)}K`
  return `₱${Math.round(n).toLocaleString()}`
}

function computeBreakdown(payslips: PayslipRow[]) {
  let basicSalary = 0
  let allowances = 0
  let deductions = 0
  for (const p of payslips) {
    basicSalary += Number(p.employee?.salary ?? 0)
    allowances += Number(p.employee?.allowance ?? 0)
    deductions += Number(p.employee?.loanDeduction ?? 0)
  }
  const netPay = basicSalary + allowances - deductions
  return { basicSalary, allowances, deductions, netPay }
}

export default function PayrollSummaryWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs' || variant === 'sm'

  const [period, setPeriod] = useState<PayrollPeriod | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .get<PayrollPeriod[]>('/payroll/periods')
      .then((res) => {
        if (cancelled) return
        setPeriod(Array.isArray(res.data) && res.data.length > 0 ? res.data[0] : null)
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
        <div className="h-16 rounded-xl bg-zinc-100 animate-pulse" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-zinc-100 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!period) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center gap-1">
        <p className="text-xs font-medium text-zinc-600">No payroll period yet</p>
        <p className="text-[10px] text-zinc-400">
          Create a payroll period to see payroll data here
        </p>
      </div>
    )
  }

  const payslips = period.payslips ?? []
  const { basicSalary, allowances, deductions, netPay } = computeBreakdown(payslips)
  const headcount = payslips.length

  const breakdown = [
    { label: 'Basic Salary', amount: fmtMoney(basicSalary) },
    { label: 'Allowances', amount: fmtMoney(allowances) },
    { label: 'Deductions', amount: deductions > 0 ? `-${fmtMoney(deductions)}` : fmtMoney(0) },
  ]

  const summary = [
    { label: 'Headcount', value: String(headcount) },
    { label: 'Net Pay', value: fmtMoney(netPay) },
    { label: 'Status', value: period.status ?? '—' },
  ]

  const periodLabel = period.name ?? 'Current Period'

  if (isCompact) {
    return (
      <div className="flex flex-col gap-2">
        <div className="rounded-lg bg-purple-50 p-2.5">
          <p className="text-[10px] font-medium text-purple-600">Current Period</p>
          <p className="text-sm font-bold text-purple-900">{periodLabel}</p>
        </div>
        {summary.map((s) => (
          <div key={s.label} className="flex items-center justify-between px-1">
            <p className="text-xs text-zinc-500">{s.label}</p>
            <p className="text-xs font-bold text-zinc-900">{s.value}</p>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-xl bg-purple-50 p-3">
        <div>
          <p className="text-[10px] font-medium text-purple-600">Current Period</p>
          <p className="text-sm font-bold text-purple-900">{periodLabel}</p>
          {period.startDate && period.endDate && (
            <p className="text-[10px] text-purple-600">
              {new Date(period.startDate).toLocaleDateString('en-PH', {
                month: 'short',
                day: 'numeric',
              })}
              –
              {new Date(period.endDate).toLocaleDateString('en-PH', {
                month: 'short',
                day: 'numeric',
              })}
            </p>
          )}
        </div>
        <TrendingUp className="h-6 w-6 text-purple-400 shrink-0" />
      </div>

      <div className="space-y-1.5">
        {breakdown.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between border-b border-zinc-100 pb-1.5 last:border-0"
          >
            <p className="text-xs text-zinc-600 truncate">{item.label}</p>
            <p
              className={`text-xs font-semibold shrink-0 ml-2 ${item.amount.startsWith('-') ? 'text-red-600' : 'text-zinc-900'}`}
            >
              {item.amount}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {summary.map((s) => (
          <div key={s.label} className="flex-1 rounded-lg bg-zinc-50 p-2 text-center min-w-0">
            <p className="text-[10px] text-zinc-500 truncate">{s.label}</p>
            <p className="text-xs font-bold text-zinc-900 truncate">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
