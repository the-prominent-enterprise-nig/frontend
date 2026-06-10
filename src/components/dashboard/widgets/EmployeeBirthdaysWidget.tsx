'use client'

import { Cake } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useWidgetSize } from '../WidgetSizeContext'
import { api } from '@/src/libs/api/client'

type Employee = {
  id: string
  firstName?: string | null
  lastName?: string | null
  dateOfBirth?: string | null
  department?: { name?: string | null } | null
}

type EmployeeListPayload = Employee[] | { data?: Employee[] }

const INITIALS = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
const sameMonthDay = (a: Date, b: Date) =>
  a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const nextBirthday = (birthDate: Date, today: Date) => {
  const next = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate())
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    next.setFullYear(today.getFullYear() + 1)
  }
  return next
}

export default function EmployeeBirthdaysWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'
  const limit = isCompact ? 3 : 5
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadEmployees() {
      setLoading(true)
      const result = await api.get<EmployeeListPayload>('/employees', { limit: 500 })
      if (!active) return
      setEmployees(Array.isArray(result.data) ? result.data : (result.data?.data ?? []))
      setLoading(false)
    }

    loadEmployees()

    return () => {
      active = false
    }
  }, [])

  const birthdays = useMemo(() => {
    const today = new Date()
    return employees
      .filter((employee) => employee.dateOfBirth)
      .map((employee) => {
        const birthDate = new Date(employee.dateOfBirth as string)
        const upcoming = nextBirthday(birthDate, today)
        return {
          id: employee.id,
          name:
            `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim() || 'Unnamed employee',
          dept: employee.department?.name || 'Unassigned',
          date: new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(
            upcoming
          ),
          isToday: sameMonthDay(birthDate, today),
          upcoming,
        }
      })
      .sort((a, b) => a.upcoming.getTime() - b.upcoming.getTime())
  }, [employees])

  if (loading) {
    return (
      <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">Loading birthdays...</div>
    )
  }

  if (birthdays.length === 0) {
    return (
      <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">
        No employee birthdays yet.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {birthdays.slice(0, limit).map((person) => (
        <div
          key={person.id}
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition ${person.isToday ? 'bg-purple-50 ring-1 ring-purple-200' : 'hover:bg-zinc-50'}`}
        >
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${person.isToday ? 'bg-purple-600 text-white' : 'bg-zinc-100 text-zinc-600'}`}
          >
            {INITIALS(person.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-zinc-900">{person.name}</p>
            {!isCompact && <p className="text-[10px] text-zinc-500">{person.dept}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {person.isToday && <Cake className="h-3.5 w-3.5 text-purple-500" />}
            <p
              className={`text-[10px] font-medium ${person.isToday ? 'text-purple-600' : 'text-zinc-400'}`}
            >
              {person.isToday ? 'Today' : person.date}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
