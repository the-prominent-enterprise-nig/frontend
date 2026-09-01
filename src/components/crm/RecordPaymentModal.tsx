'use client'

import { useState } from 'react'
import { X, CheckCircle2, XCircle } from 'lucide-react'
import { installmentAccountsApi } from '@/src/libs/api/crm'
import { recordPaymentSchema, type RecordPaymentInput } from '@/src/schema/crm/installment-account'

export default function RecordPaymentModal({
  open,
  onClose,
  onRecorded,
  accountId,
  suggestedAmount,
  suggestedRebate,
  monthlyInstallment,
  partialPaymentOnNextDue,
}: {
  open: boolean
  onClose: () => void
  onRecorded?: () => void
  accountId: string
  suggestedAmount: number
  /** This account's ppd (Prompt Payment Discount) — the cap for the rebate field below. */
  suggestedRebate?: number
  /** Drives the "this covers N month(s)" preview below — no term picker, a
   * lump sum just settles as many months as it covers, in order. */
  monthlyInstallment: number
  /** Already paid toward the next not-yet-fully-covered due, carried over
   * from a prior under-one-month payment. */
  partialPaymentOnNextDue: number
}) {
  const [form, setForm] = useState<RecordPaymentInput>({
    // Nets out the suggested rebate so accepting both defaults as-is
    // settles the due exactly, rather than over-crediting the balance
    // (amount + rebate > what's actually due this month).
    amount: Math.max(Math.round((suggestedAmount - (suggestedRebate ?? 0)) * 100) / 100, 0),
    dueDate: new Date().toISOString().slice(0, 10),
    paidAt: new Date().toISOString().slice(0, 10),
    orNumber: '',
    rebateAmount: suggestedRebate ?? 0,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [result, setResult] = useState<{ onTime: boolean; monthsCovered: number } | null>(null)

  if (!open) return null

  const setField = <K extends keyof RecordPaymentInput>(key: K, value: RecordPaymentInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const rebateExceedsCap = (form.rebateAmount ?? 0) > (suggestedRebate ?? 0) + 0.01

  // Live preview — no term picker, this amount (plus whatever's already
  // carried forward toward the next due) just settles as many whole months
  // as it covers, mirroring recordPayment()'s own floor-division.
  const availableForCoverage =
    partialPaymentOnNextDue + (form.amount || 0) + (form.rebateAmount ?? 0)
  const monthsCoveredPreview =
    monthlyInstallment > 0 ? Math.floor(availableForCoverage / monthlyInstallment) : 0
  const previewRemainder = Math.max(
    Math.round((availableForCoverage - monthsCoveredPreview * monthlyInstallment) * 100) / 100,
    0
  )

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    const parsed = recordPaymentSchema.safeParse(form)
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
    const res = await installmentAccountsApi.recordPayment(accountId, {
      ...parsed.data,
      dueDate: new Date(parsed.data.dueDate).toISOString(),
      paidAt: new Date(parsed.data.paidAt).toISOString(),
    })
    setSubmitting(false)
    if (res.success && res.data) {
      setResult({ onTime: res.data.pointEarned, monthsCovered: res.data.monthsCovered })
      onRecorded?.()
    } else {
      setServerError(res.error ?? 'Failed to record payment')
    }
  }

  function handleClose() {
    setResult(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Record payment</h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {result !== null ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            {result.onTime ? (
              <>
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="text-sm font-medium text-gray-900">
                  Payment recorded — on time, +{result.monthsCovered} point
                  {result.monthsCovered !== 1 ? 's' : ''} earned.
                </p>
              </>
            ) : (
              <>
                <XCircle className="h-10 w-10 text-amber-500" />
                <p className="text-sm font-medium text-gray-900">
                  Payment recorded — paid after the due date, no points earned.
                </p>
              </>
            )}
            {result.monthsCovered > 0 && (
              <p className="text-[12px] text-gray-500">
                Covered {result.monthsCovered} month{result.monthsCovered !== 1 ? 's' : ''} on this
                account.
              </p>
            )}
            <button
              onClick={handleClose}
              className="mt-2 rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="payment-amount"
                className="block text-[13px] font-medium text-gray-700"
              >
                Amount (₱) *
              </label>
              <input
                id="payment-amount"
                type="number"
                step="0.01"
                min="0"
                value={form.amount === 0 ? '' : form.amount}
                onChange={(e) => setField('amount', Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
              {errors.amount && <p className="mt-1 text-[12px] text-red-600">{errors.amount}</p>}
              {form.amount > 0 && (
                <p className="mt-1 text-[12px] text-gray-500">
                  {monthsCoveredPreview > 0
                    ? `Covers ${monthsCoveredPreview} month${monthsCoveredPreview !== 1 ? 's' : ''}` +
                      (previewRemainder > 0
                        ? ` — ₱${previewRemainder.toLocaleString()} left toward the following due.`
                        : '.')
                    : `Partial — ₱${availableForCoverage.toLocaleString()} of ₱${monthlyInstallment.toLocaleString()} toward this due.`}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="payment-dueDate"
                className="block text-[13px] font-medium text-gray-700"
              >
                Due date *
              </label>
              <input
                id="payment-dueDate"
                type="date"
                value={form.dueDate}
                onChange={(e) => setField('dueDate', e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
              {errors.dueDate && <p className="mt-1 text-[12px] text-red-600">{errors.dueDate}</p>}
            </div>

            <div>
              <label
                htmlFor="payment-paidAt"
                className="block text-[13px] font-medium text-gray-700"
              >
                Paid at *
              </label>
              <input
                id="payment-paidAt"
                type="date"
                value={form.paidAt}
                onChange={(e) => setField('paidAt', e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
              {errors.paidAt && <p className="mt-1 text-[12px] text-red-600">{errors.paidAt}</p>}
              <p className="mt-1 text-[12px] text-gray-400">
                Paid on or before the due date earns +1 point; after the due date earns 0.
              </p>
            </div>

            <div>
              <label
                htmlFor="payment-orNumber"
                className="block text-[13px] font-medium text-gray-700"
              >
                OR number
              </label>
              <input
                id="payment-orNumber"
                value={form.orNumber ?? ''}
                onChange={(e) => setField('orNumber', e.target.value)}
                placeholder="e.g. OR-1234"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="payment-rebateAmount"
                className="block text-[13px] font-medium text-gray-700"
              >
                Rebate (Prompt Payment Discount)
              </label>
              <input
                id="payment-rebateAmount"
                type="number"
                step="0.01"
                min="0"
                value={form.rebateAmount ?? 0}
                onChange={(e) => setField('rebateAmount', Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[12px] text-gray-400">
                {suggestedRebate
                  ? `Up to ₱${suggestedRebate.toLocaleString()} for this account.`
                  : 'No rebate available for this account.'}
              </p>
              {rebateExceedsCap && (
                <p className="mt-1 text-[12px] font-medium text-red-600">
                  Rebate can&apos;t exceed ₱{(suggestedRebate ?? 0).toLocaleString()}.
                </p>
              )}
            </div>

            {serverError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || rebateExceedsCap}
                className="rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:opacity-50"
              >
                {submitting ? 'Recording…' : 'Record payment'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
