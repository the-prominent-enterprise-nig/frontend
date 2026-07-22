'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { collectorsApi } from '@/src/libs/api/crm'
import { createRemittanceSchema, type CreateRemittanceInput } from '@/src/schema/crm/collector'

export default function RecordRemittanceModal({
  open,
  onClose,
  onRecorded,
  collectorId,
}: {
  open: boolean
  onClose: () => void
  onRecorded?: () => void
  collectorId: string
}) {
  const [form, setForm] = useState<CreateRemittanceInput>({
    amount: 0,
    remittedAt: new Date().toISOString().slice(0, 16),
    reference: '',
    collectionBatch: '',
    notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  if (!open) return null

  const setField = <K extends keyof CreateRemittanceInput>(
    key: K,
    value: CreateRemittanceInput[K]
  ) => setForm((f) => ({ ...f, [key]: value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    const parsed = createRemittanceSchema.safeParse(form)
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      parsed.error.issues.forEach((i) => {
        errs[i.path[0] as string] = i.message
      })
      setErrors(errs)
      return
    }
    setErrors({})
    setSubmitting(true)
    const res = await collectorsApi.remit(collectorId, {
      ...parsed.data,
      remittedAt: new Date(parsed.data.remittedAt).toISOString(),
    })
    setSubmitting(false)
    if (res.success) {
      onRecorded?.()
      onClose()
      setForm({
        amount: 0,
        remittedAt: new Date().toISOString().slice(0, 16),
        reference: '',
        collectionBatch: '',
        notes: '',
      })
    } else {
      setServerError(res.error ?? 'Failed to record remittance')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Record remittance</h2>
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
            <label className="block text-[13px] font-medium text-gray-700">Amount (₱) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setField('amount', Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            {errors.amount && <p className="mt-1 text-[12px] text-red-600">{errors.amount}</p>}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-700">Remitted at *</label>
            <input
              type="datetime-local"
              value={form.remittedAt}
              onChange={(e) => setField('remittedAt', e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            {errors.remittedAt && (
              <p className="mt-1 text-[12px] text-red-600">{errors.remittedAt}</p>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-700">Reference</label>
            <input
              value={form.reference ?? ''}
              onChange={(e) => setField('reference', e.target.value)}
              placeholder="e.g. OR number"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-700">Collection batch</label>
            <input
              value={form.collectionBatch ?? ''}
              onChange={(e) => setField('collectionBatch', e.target.value)}
              placeholder="e.g. Route 3 — 2026-07-15"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-700">Notes</label>
            <textarea
              rows={3}
              value={form.notes ?? ''}
              onChange={(e) => setField('notes', e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          {serverError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
          )}

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
              {submitting ? 'Recording…' : 'Record remittance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
