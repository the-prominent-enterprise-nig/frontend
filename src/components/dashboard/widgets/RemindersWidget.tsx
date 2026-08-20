'use client'

import { useEffect, useState } from 'react'
import { Bell, Check } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'
import { useMe } from '@/src/hooks/useMe'
import { api } from '@/src/libs/api/client'

type Reminder = {
  id: string
  reminderType: 'call' | 'email' | 'visit' | 'other'
  dueAt: string
  note?: string | null
  isOverdue: boolean
}

const TYPE_LABELS: Record<Reminder['reminderType'], string> = {
  call: 'Call',
  email: 'Email',
  visit: 'Visit',
  other: 'Reminder',
}

function formatDue(dueAt: string, isOverdue: boolean): string {
  if (isOverdue) return 'Overdue'
  const date = new Date(dueAt)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return 'Due today'
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (date.toDateString() === tomorrow.toDateString()) return 'Due tomorrow'
  return `Due ${date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`
}

export default function RemindersWidget() {
  const { variant } = useWidgetSize()
  const limit = variant === 'xs' ? 3 : 5
  const { data: me } = useMe()

  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!me?.id) return
    let active = true
    api.get<Reminder[]>('/crm/reminders/mine', { userId: me.id }).then((res) => {
      if (!active) return
      setReminders(res.data ?? [])
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [me?.id])

  if (loading) {
    return (
      <div className="flex flex-col gap-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 rounded-lg bg-zinc-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (reminders.length === 0) {
    return <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">No reminders due.</div>
  }

  return (
    <div className="flex flex-col gap-1">
      {reminders.slice(0, limit).map((r) => {
        const text = r.note?.trim() || TYPE_LABELS[r.reminderType] || 'Reminder'
        return (
          <div
            key={r.id}
            className="flex items-start gap-2 rounded-lg p-2 hover:bg-zinc-50 transition"
          >
            <div
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${r.isOverdue ? 'border-red-400 bg-red-50' : 'border-zinc-200'}`}
            >
              <Check className={`h-2.5 w-2.5 ${r.isOverdue ? 'text-red-400' : 'text-zinc-300'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-zinc-800 leading-snug truncate">{text}</p>
              {variant !== 'xs' && (
                <p
                  className={`text-[10px] mt-0.5 flex items-center gap-0.5 ${r.isOverdue ? 'font-medium text-red-500' : 'text-zinc-400'}`}
                >
                  <Bell className="h-2.5 w-2.5" />
                  {formatDue(r.dueAt, r.isOverdue)}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
