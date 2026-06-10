'use client'

import { useEffect, useState } from 'react'
import { useWidgetSize } from '../WidgetSizeContext'
import { api } from '@/src/libs/api/client'

type AttendanceSummary = {
  totalDaysWorked?: number | null
  totalAbsences?: number | null
  totalTardiness?: number | null
  leaveDaysRecorded?: number | null
}

const EMPTY_STATS = [
  { label: 'Present', value: 0, textColor: 'text-emerald-600' },
  { label: 'Absent', value: 0, textColor: 'text-red-600' },
  { label: 'Late', value: 0, textColor: 'text-amber-600' },
  { label: 'On Leave', value: 0, textColor: 'text-blue-600' },
]

export default function AttendanceSummaryWidget() {
  const { variant } = useWidgetSize()
  const showDepts = variant === 'lg' || variant === 'md'
  const [stats, setStats] = useState(EMPTY_STATS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadSummary() {
      setLoading(true)
      const result = await api.get<AttendanceSummary[]>('/attendance/summary')
      if (!active) return

      const summaries = result.data ?? []
      const total = (key: keyof AttendanceSummary) =>
        summaries.reduce((sum, row) => sum + Number(row[key] ?? 0), 0)

      setStats([
        { label: 'Present', value: total('totalDaysWorked'), textColor: 'text-emerald-600' },
        { label: 'Absent', value: total('totalAbsences'), textColor: 'text-red-600' },
        { label: 'Late', value: total('totalTardiness'), textColor: 'text-amber-600' },
        { label: 'On Leave', value: total('leaveDaysRecorded'), textColor: 'text-blue-600' },
      ])
      setLoading(false)
    }

    loadSummary()

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="flex flex-col gap-3">
      {/* xs/sm: 2 cols to prevent cramping; md/lg: 4 cols */}
      <div
        className={`grid gap-2 ${variant === 'xs' || variant === 'sm' ? 'grid-cols-2' : 'grid-cols-4'}`}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex flex-col items-center gap-0.5 rounded-xl bg-zinc-50 p-2 text-center"
          >
            <p
              className={`font-bold leading-none ${variant === 'xs' ? 'text-xl' : 'text-2xl'} ${s.textColor}`}
            >
              {loading ? '...' : s.value}
            </p>
            <p className="text-[10px] text-zinc-500">{s.label}</p>
          </div>
        ))}
      </div>

      {showDepts && (
        <div className="rounded-lg bg-zinc-50 p-2 text-[10px] text-zinc-500">
          Department attendance is coming soon.
        </div>
      )}
    </div>
  )
}
