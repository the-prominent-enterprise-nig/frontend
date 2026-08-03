'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { remindersApi } from '@/src/libs/api/crm'

export default function CompleteReminderModal({
  open,
  onClose,
  onCompleted,
  reminderId,
}: {
  open: boolean
  onClose: () => void
  onCompleted?: () => void
  reminderId: string | null
}) {
  const [outcome, setOutcome] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open || !reminderId) return null

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const res = await remindersApi.complete(reminderId as string, {
      outcome: outcome || undefined,
      contactPhone: contactPhone || undefined,
    })
    setSubmitting(false)
    if (res.success) {
      onCompleted?.()
      onClose()
      setOutcome('')
      setContactPhone('')
    } else {
      setError(res.message ?? 'Failed to complete reminder')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Complete reminder</h2>
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
            <label
              htmlFor="complete-reminder-phone"
              className="block text-[13px] font-medium text-gray-700"
            >
              Contact phone / channel
            </label>
            <input
              id="complete-reminder-phone"
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="e.g. +639171234567"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="complete-reminder-outcome"
              className="block text-[13px] font-medium text-gray-700"
            >
              Outcome / proof
            </label>
            <textarea
              id="complete-reminder-outcome"
              rows={3}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="e.g. Reached customer, promised to pay by Friday"
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
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? 'Completing…' : 'Complete'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
