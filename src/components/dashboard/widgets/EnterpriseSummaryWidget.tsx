'use client'

import { useEffect, useState } from 'react'
import { Users, UserCheck } from 'lucide-react'
import { getEnterpriseSummary, type EnterpriseSummary } from '@/src/libs/actions/enterprise.actions'

export default function EnterpriseSummaryWidget() {
  const [data, setData] = useState<EnterpriseSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEnterpriseSummary().then((r) => {
      if (r.success && r.data) setData(r.data)
      setLoading(false)
    })
  }, [])

  const stats = [
    {
      label: 'Employees',
      value: data?.employeeCount ?? 0,
      icon: Users,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Users',
      value: data?.userCount ?? 0,
      icon: UserCheck,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
  ]

  if (loading) return <div className="h-24 animate-pulse rounded-xl bg-zinc-100" />

  return (
    <div className="grid grid-cols-2 gap-2">
      {stats.map((s) => {
        const Icon = s.icon
        return (
          <div
            key={s.label}
            className="flex flex-col gap-1.5 rounded-xl bg-white p-3 shadow-sm ring-1 ring-zinc-100"
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.iconBg}`}>
              <Icon className={`h-4 w-4 ${s.iconColor}`} />
            </div>
            <p className="text-2xl font-bold text-zinc-900">{s.value}</p>
            <p className="text-xs text-zinc-500">{s.label}</p>
          </div>
        )
      })}
    </div>
  )
}
