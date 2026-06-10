'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { remindersApi } from '@/src/libs/api/crm'
import type { ReminderType } from '@/src/schema/crm/types'

type Target = { leadId: string } | { customerId: string }

export default function ScheduleReminderModal({
  open,
  onClose,
  onCreated,
  tenantId,
  assignedTo,
  target,
}: {
  open: boolean
  onClose: () => void
  onCreated?: () => void
  tenantId: string
  assignedTo: string
  target: Target
}) {
  const [reminderType, setReminderType] = useState<ReminderType>('call')
  const [dueAt, setDueAt] = useState(() => {
    // Default to tomorrow 9am local
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    return toDatetimeLocal(d)
  })
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const res = await remindersApi.create({
      tenantId,
      assignedTo,
      reminderType,
      dueAt: new Date(dueAt).toISOString(),
      note: note || undefined,
      ...target,
    })
    setSubmitting(false)
    if (res.success) {
      onCreated?.()
      onClose()
      // Reset for next open
      setNote('')
    } else {
      setError(res.message ?? 'Failed to schedule reminder')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Schedule reminder</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Type</label>
            <select
              value={reminderType}
              onChange={(e) => setReminderType(e.target.value as ReminderType)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="visit">Visit</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-700">Due at *</label>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-700">Note</label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Follow up on Q2 proposal"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:opacity-50"
            >
              {submitting ? 'Scheduling…' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// HTML datetime-local needs YYYY-MM-DDTHH:mm in the user's local time.
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
