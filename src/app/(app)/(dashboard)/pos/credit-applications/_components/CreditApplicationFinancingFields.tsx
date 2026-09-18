'use client'

import { useEffect, useState } from 'react'
import {
  Controller,
  useWatch,
  type Control,
  type FieldErrors,
  type FieldValues,
  type Path,
} from 'react-hook-form'
import { Calculator, Loader2 } from 'lucide-react'
import {
  getPosPriceUseTypes,
  getActiveFinancingTerms,
  previewInstallment,
  type PosPriceUseType,
} from '../../_actions/pos-actions'
import type { FinancingTerm, InstallmentPreview } from '@/src/schema/pos'

function formatPeso(n: number): string {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

type FinancingScopedFormValues = FieldValues & {
  items?: { estimatedPrice?: number }[]
  priceUseTypeId?: string
  financingTermId?: string
  downPayment?: string
}

type Props<T extends FinancingScopedFormValues> = {
  control: Control<T>
  errors: FieldErrors<T>
  /** Scopes the financing term list the same way checkout's own selector
   * does — a branch's own terms plus tenant-wide ones. */
  branchId?: string | null
}

// Price Use + financing term + down payment, captured at intake (client
// request, 2026-09-18) so the applicant and whoever's taking the
// application both see the real numbers — DP, monthly installment, total
// payable — before anything is submitted, not just the raw item total.
// Both DP and term are optional; the item total alone still shows with
// neither picked. The preview is a live call to the same
// FinancingTermsService.preview() checkout itself uses, so the figures
// shown here can never drift from what an actual sale would compute — see
// CreditApplicationService.resolveFinancing() for the equivalent
// server-side snapshot taken at submit time.
export function CreditApplicationFinancingFields<T extends FinancingScopedFormValues>({
  control,
  errors,
  branchId,
}: Props<T>) {
  const items = useWatch({ control, name: 'items' as Path<T> }) as
    | { estimatedPrice?: number }[]
    | undefined
  const financingTermId = useWatch({ control, name: 'financingTermId' as Path<T> }) as
    | string
    | undefined
  const downPaymentInput = useWatch({ control, name: 'downPayment' as Path<T> }) as
    | string
    | undefined

  const estimatedTotal = (items ?? []).reduce((sum, i) => sum + (i.estimatedPrice ?? 0), 0)

  const [priceUseTypes, setPriceUseTypes] = useState<PosPriceUseType[]>([])
  const [financingTerms, setFinancingTerms] = useState<FinancingTerm[]>([])

  useEffect(() => {
    getPosPriceUseTypes().then((res) => setPriceUseTypes(res.data ?? []))
  }, [])

  useEffect(() => {
    getActiveFinancingTerms(branchId ?? undefined).then((res) => setFinancingTerms(res.data ?? []))
  }, [branchId])

  const [preview, setPreview] = useState<InstallmentPreview | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (!financingTermId || estimatedTotal <= 0) {
      setPreview(null)
      setPreviewError('')
      setPreviewLoading(false)
      return
    }
    const downPayment = parseFloat(downPaymentInput ?? '')
    if (!downPaymentInput || Number.isNaN(downPayment)) {
      setPreview(null)
      setPreviewError('')
      setPreviewLoading(false)
      return
    }

    let cancelled = false
    setPreviewLoading(true)
    setPreviewError('')
    // Debounced — a keystroke-per-request preview would hammer the backend
    // on every digit typed into Down Payment.
    const timer = setTimeout(() => {
      previewInstallment({ totalAmount: estimatedTotal, downPayment, financingTermId }).then(
        (res) => {
          if (cancelled) return
          setPreviewLoading(false)
          if (res.success && res.data) {
            setPreview(res.data)
          } else {
            setPreview(null)
            setPreviewError(res.error ?? 'Could not compute the installment preview')
          }
        }
      )
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [estimatedTotal, financingTermId, downPaymentInput])

  const selectedTerm = financingTerms.find((t) => t.id === financingTermId)
  const downPaymentError = (errors.downPayment as { message?: string } | undefined)?.message

  return (
    <div className="space-y-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-zinc-400" />
        <h3 className="text-sm font-medium text-zinc-700">Price Use &amp; Financing</h3>
        <span className="text-xs text-zinc-400">(optional)</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Price Use</label>
          <Controller
            name={'priceUseTypeId' as Path<T>}
            control={control}
            render={({ field }) => (
              <select
                {...field}
                value={(field.value as string | undefined) ?? ''}
                className={`${fieldClass} bg-white`}
              >
                <option value="">Default (WIP)</option>
                {priceUseTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Financing Term</label>
          <Controller
            name={'financingTermId' as Path<T>}
            control={control}
            render={({ field }) => (
              <select
                {...field}
                value={(field.value as string | undefined) ?? ''}
                className={`${fieldClass} bg-white`}
              >
                <option value="">No installment term</option>
                {financingTerms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.termMonths} mo. — factor {Number(t.factorRate).toFixed(2)}
                  </option>
                ))}
              </select>
            )}
          />
        </div>
      </div>

      {financingTermId && (
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">
            Down Payment <span className="text-red-500">*</span>
          </label>
          <Controller
            name={'downPayment' as Path<T>}
            control={control}
            render={({ field }) => (
              <input
                {...field}
                value={(field.value as string | undefined) ?? ''}
                type="text"
                inputMode="decimal"
                placeholder={
                  estimatedTotal > 0 ? `Min. ${formatPeso(estimatedTotal * 0.1)}` : '0.00'
                }
                className={fieldClass}
              />
            )}
          />
          {downPaymentError && <p className="mt-1 text-xs text-red-600">{downPaymentError}</p>}
        </div>
      )}

      {/* Live value breakdown — the "both customer and collector are aware
          of the value" requirement: visible before anything is submitted,
          not just recoverable later from the detail page. */}
      <div className="rounded-lg bg-white p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">Item total</span>
          <span className="font-semibold text-zinc-900">
            {estimatedTotal > 0 ? formatPeso(estimatedTotal) : '—'}
          </span>
        </div>
        {financingTermId &&
          (previewLoading ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Computing…
            </div>
          ) : previewError ? (
            <p className="mt-2 text-xs text-red-600">{previewError}</p>
          ) : preview ? (
            <div className="mt-2 space-y-1 border-t border-zinc-100 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Amount financed</span>
                <span className="text-zinc-700">{formatPeso(preview.amountFinanced)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">
                  Monthly installment{selectedTerm ? ` × ${selectedTerm.termMonths} mo.` : ''}
                </span>
                <span className="text-zinc-700">{formatPeso(preview.monthlyInstallment)}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-zinc-700">Total payable</span>
                <span className="text-prominent-purple-700">
                  {formatPeso(preview.totalPayable)}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-zinc-400">Enter a down payment to see the schedule.</p>
          ))}
      </div>
    </div>
  )
}
