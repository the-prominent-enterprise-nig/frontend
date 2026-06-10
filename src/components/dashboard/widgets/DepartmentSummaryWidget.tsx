'use client'

import { useEffect, useState } from 'react'
import { useWidgetSize } from '../WidgetSizeContext'
import { api } from '@/src/libs/api/client'

type Employee = {
  status?: string | null
  department?: { name?: string | null } | null
}

type EmployeeListPayload = Employee[] | { data?: Employee[] }

const COLORS = [
  'bg-purple-500',
  'bg-emerald-500',
  'bg-blue-500',
  'bg-amber-500',
  'bg-pink-500',
  'bg-zinc-400',
]

export default function DepartmentSummaryWidget() {
  const { variant } = useWidgetSize()
  const showBars = variant !== 'xs'
  const limit = variant === 'xs' ? 4 : 6
  const [departments, setDepartments] = useState<
    { name: string; headcount: number; active: number; color: string }[]
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadEmployees() {
      setLoading(true)
      const result = await api.get<EmployeeListPayload>('/employees', { limit: 500 })
      if (!active) return

      const employees = Array.isArray(result.data) ? result.data : (result.data?.data ?? [])
      const grouped = new Map<string, { name: string; headcount: number; active: number }>()

      employees.forEach((employee) => {
        const name = employee.department?.name || 'Unassigned'
        const current = grouped.get(name) ?? { name, headcount: 0, active: 0 }
        current.headcount += 1
        if (String(employee.status ?? '').toLowerCase() === 'active') {
          current.active += 1
        }
        grouped.set(name, current)
      })

      setDepartments(
        [...grouped.values()]
          .sort((a, b) => b.headcount - a.headcount)
          .map((dept, index) => ({ ...dept, color: COLORS[index % COLORS.length] }))
      )
      setLoading(false)
    }

    loadEmployees()

    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">Loading departments...</div>
    )
  }

  if (departments.length === 0) {
    return (
      <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">
        No department headcount yet.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {departments.slice(0, limit).map((dept) => {
        const activePct = Math.round((dept.active / dept.headcount) * 100)
        return (
          <div key={dept.name} className="rounded-lg bg-zinc-50 px-2.5 py-2">
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${dept.color}`} />
                <p className="truncate text-xs font-medium text-zinc-800">{dept.name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2 text-[10px] text-zinc-500">
                <span className="text-emerald-600 font-medium">{dept.active}</span>
                <span>/{dept.headcount}</span>
              </div>
            </div>
            {showBars && (
              <div className="mt-1.5 h-1 w-full rounded-full bg-zinc-200">
                <div
                  className={`h-1 rounded-full ${dept.color}`}
                  style={{ width: `${activePct}%` }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
