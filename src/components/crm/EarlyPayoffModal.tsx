'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { installmentAccountsApi } from '@/src/libs/api/crm'
import { earlyPayoffSchema, type EarlyPayoffInput } from '@/src/schema/crm/installment-account'

export default function EarlyPayoffModal({
  open,
  onClose,
  onSettled,
  accountId,
  suggestedAmount,
}: {
  open: boolean
  onClose: () => void
  onSettled?: () => void
  accountId: string
  suggestedAmount: number
}) {
  const [form, setForm] = useState<EarlyPayoffInput>({
    payoffAmount: suggestedAmount,
    paidAt: new Date().toISOString().slice(0, 10),
    orNumber: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  if (!open) return null

  const setField = <K extends keyof EarlyPayoffInput>(key: K, value: EarlyPayoffInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    const parsed = earlyPayoffSchema.safeParse(form)
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
    const res = await installmentAccountsApi.earlyPayoff(accountId, {
      ...parsed.data,
      paidAt: new Date(parsed.data.paidAt).toISOString(),
    })
    setSubmitting(false)
    if (res.success) {
      onSettled?.()
      onClose()
    } else {
      setServerError(res.error ?? 'Failed to settle account')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Settle account early</h2>
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
            <label className="block text-[13px] font-medium text-gray-700">
              Payoff amount (₱) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.payoffAmount}
              onChange={(e) => setField('payoffAmount', Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            {errors.payoffAmount && (
              <p className="mt-1 text-[12px] text-red-600">{errors.payoffAmount}</p>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-700">Paid at *</label>
            <input
              type="date"
              value={form.paidAt}
              onChange={(e) => setField('paidAt', e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            {errors.paidAt && <p className="mt-1 text-[12px] text-red-600">{errors.paidAt}</p>}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-700">OR number</label>
            <input
              value={form.orNumber ?? ''}
              onChange={(e) => setField('orNumber', e.target.value)}
              placeholder="e.g. OR-1234"
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
              {submitting ? 'Settling…' : 'Settle account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
