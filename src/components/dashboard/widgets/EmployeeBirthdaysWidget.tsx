'use client'

import { useEffect, useState } from 'react'
import { Cake } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'
import { api } from '@/src/libs/api/client'

type EmployeeBirthday = {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string // YYYY-MM-DD
}

export default function EmployeeBirthdaysWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'

  const [employees, setEmployees] = useState<EmployeeBirthday[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.get<EmployeeBirthday[]>('/users/birthdays').then((res) => {
      if (!active) return
      setEmployees(res.data ?? [])
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const now = new Date()
  const month = now.getMonth()
  const today = now.getDate()

  const birthdays = employees
    .filter((emp) => new Date(emp.dateOfBirth + 'T00:00:00').getMonth() === month)
    .map((emp) => {
      const dob = new Date(emp.dateOfBirth + 'T00:00:00')
      const dayNum = dob.getDate()
      const isToday = dayNum === today
      const dateStr = dob.toLocaleString('en-PH', { month: 'short', day: 'numeric' })
      const name = `${emp.firstName} ${emp.lastName}`.trim()
      return { id: emp.id, dayNum, name, isToday, dateStr }
    })
    .sort((a, b) => {
      if (a.isToday !== b.isToday) return a.isToday ? -1 : 1
      const aDist = (a.dayNum - today + 31) % 31
      const bDist = (b.dayNum - today + 31) % 31
      return aDist - bDist
    })

  if (loading) {
    return (
      <div className="flex flex-col gap-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 rounded-lg bg-zinc-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (birthdays.length === 0) {
    return (
      <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">
        No birthdays this month.
      </div>
    )
  }

  const limit = isCompact ? 3 : 5

  return (
    <div className="flex flex-col gap-1">
      {birthdays.slice(0, limit).map(({ id, name, isToday, dateStr }) => (
        <div
          key={id}
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition ${isToday ? 'bg-purple-50 ring-1 ring-purple-200' : 'hover:bg-zinc-50'}`}
        >
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isToday ? 'bg-purple-600 text-white' : 'bg-zinc-100 text-zinc-500'}`}
          >
            <Cake className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-zinc-900">{name}</p>
            {!isCompact && <p className="text-[10px] text-zinc-400">Birthday</p>}
          </div>
          <p
            className={`shrink-0 text-[10px] font-medium ${isToday ? 'text-purple-600' : 'text-zinc-400'}`}
          >
            {isToday ? 'Today' : dateStr}
          </p>
        </div>
      ))}
    </div>
  )
}
