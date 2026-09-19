'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Controller,
  useWatch,
  type Control,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormSetValue,
  type UseFormTrigger,
} from 'react-hook-form'
import { Calculator, Loader2 } from 'lucide-react'
import {
  getPosPriceUseTypes,
  getActiveFinancingTerms,
  previewInstallment,
  resolvePosPrices,
  type PosPriceUseType,
} from '../../_actions/pos-actions'
import { Select } from '@/src/components/ui/Select'
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
  setValue: UseFormSetValue<T>
  trigger: UseFormTrigger<T>
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
  setValue,
  trigger,
  errors,
  branchId,
}: Props<T>) {
  const items = useWatch({ control, name: 'items' as Path<T> }) as
    | { itemId?: string; estimatedPrice?: number }[]
    | undefined
  const priceUseTypeId = useWatch({ control, name: 'priceUseTypeId' as Path<T> }) as
    | string
    | undefined
  const financingTermId = useWatch({ control, name: 'financingTermId' as Path<T> }) as
    | string
    | undefined
  const downPaymentInput = useWatch({ control, name: 'downPayment' as Path<T> }) as
    | string
    | undefined

  const [priceUseTypes, setPriceUseTypes] = useState<PosPriceUseType[]>([])
  const [financingTerms, setFinancingTerms] = useState<FinancingTerm[]>([])

  useEffect(() => {
    getPosPriceUseTypes().then((res) => setPriceUseTypes(res.data ?? []))
  }, [])

  useEffect(() => {
    getActiveFinancingTerms(branchId ?? undefined).then((res) => setFinancingTerms(res.data ?? []))
  }, [branchId])

  // The item total has to be resolved the same way the server will resolve
  // it, or the figures here are a different number from the one that gets
  // stored — and the "Min. ₱X" down-payment hint disagrees with the 10%
  // floor the server actually enforces. So this calls the same
  // /pos/catalog/resolve-prices that checkout uses, under the chosen Price
  // Use, and mirrors CreditApplicationService.resolveItemPrice()'s chain:
  // the selected Price Use, else WIP (which is how the backend's
  // resolveDefaultSellingPrice finds its default — by the name 'WIP'),
  // falling back per item to the flat catalog price the combobox carried.
  const itemIds = (items ?? []).map((i) => i.itemId).filter((id): id is string => !!id)
  const itemIdsKey = itemIds.join(',')
  const wipTypeId = priceUseTypes.find((t) => t.name === 'WIP')?.id
  const effectivePriceUseTypeId = priceUseTypeId || wipTypeId

  const [resolvedPrices, setResolvedPrices] = useState<Record<string, number | null>>({})
  const [isResolvingPrices, setIsResolvingPrices] = useState(false)

  useEffect(() => {
    if (!effectivePriceUseTypeId || itemIds.length === 0) {
      setResolvedPrices({})
      return
    }
    let cancelled = false
    setIsResolvingPrices(true)
    resolvePosPrices(effectivePriceUseTypeId, itemIds, branchId ?? undefined).then((res) => {
      if (cancelled) return
      setIsResolvingPrices(false)
      const next: Record<string, number | null> = {}
      for (const [id, resolved] of Object.entries(res.data ?? {})) {
        next[id] = resolved ? Number(resolved.price) : null
      }
      setResolvedPrices(next)
    })
    return () => {
      cancelled = true
    }
    // itemIdsKey rather than itemIds — a fresh array identity every render
    // would re-fire this on every keystroke elsewhere in the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePriceUseTypeId, itemIdsKey, branchId])

  const estimatedTotal = (items ?? []).reduce((sum, i) => {
    const resolved = i.itemId ? resolvedPrices[i.itemId] : undefined
    return sum + (resolved ?? i.estimatedPrice ?? 0)
  }, 0)

  // The floor is checked in the schema, which can only see form state — so
  // the resolved total has to live there too, not just in this component.
  useEffect(() => {
    setValue('resolvedItemTotal' as Path<T>, estimatedTotal as never, { shouldDirty: false })
  }, [estimatedTotal, setValue])

  // Seed Down Payment with the 10% floor as a real value rather than a
  // greyed-out hint (review feedback, 2026-09-19). The hint vanished the
  // moment anything was typed, so nothing on screen held the collector to
  // the minimum and the first genuine check was a generic banner after
  // submit. Re-seeds when the term or the total changes, since the floor
  // moves with them, but never overwrites a figure already entered — the
  // collector is free to take more up front, and the schema refuses less.
  const seededForRef = useRef<string | null>(null)
  // The exact string this component last wrote. Changing the Price Use moves
  // the item total, and therefore the floor — a figure we seeded should
  // follow it, but one the collector typed must not be overwritten, so the
  // two cases are told apart by value rather than by guessing.
  const lastSeededValueRef = useRef<string | null>(null)
  useEffect(() => {
    if (!financingTermId || estimatedTotal <= 0) return
    const key = `${financingTermId}:${estimatedTotal.toFixed(2)}`
    if (seededForRef.current === key) return
    seededForRef.current = key

    const current = downPaymentInput?.trim()
    const isOurs = !current || current === lastSeededValueRef.current
    if (!isOurs) return

    const seeded = (estimatedTotal * 0.1).toFixed(2)
    lastSeededValueRef.current = seeded
    setValue('downPayment' as Path<T>, seeded as never, { shouldValidate: true })
  }, [financingTermId, estimatedTotal, downPaymentInput, setValue])

  // Validate this one field as it is typed. The form's default mode only
  // validates on submit, so a too-low figure sat there looking accepted
  // until the collector pressed the button — which is the same
  // find-out-afterwards problem the floor was added to remove. Scoped to
  // downPayment via trigger() rather than switching the whole form to
  // onChange, which would light up "Item is required" and friends before
  // anything had been filled in.
  //
  // Debounced at the same 400ms as the preview below, so the message
  // doesn't flicker through "must be at least..." on the way from "3" to
  // "3000".
  useEffect(() => {
    if (!financingTermId) return
    const timer = setTimeout(() => {
      void trigger('downPayment' as Path<T>)
    }, 400)
    return () => clearTimeout(timer)
  }, [downPaymentInput, estimatedTotal, financingTermId, trigger])

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
  // Labels the total with whichever Price Use it was actually priced under,
  // including the WIP default, so a changed dropdown visibly changes the
  // number instead of silently doing nothing.
  const selectedPriceUse = priceUseTypes.find((t) => t.id === effectivePriceUseTypeId)
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
              <Select
                value={(field.value as string | undefined) ?? ''}
                onChange={field.onChange}
                placeholder="WIP (default)"
                options={[
                  { value: '', label: 'WIP (default)' },
                  ...priceUseTypes.map((t) => ({ value: t.id, label: t.name })),
                ]}
              />
            )}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Financing Term</label>
          <Controller
            name={'financingTermId' as Path<T>}
            control={control}
            render={({ field }) => (
              <Select
                value={(field.value as string | undefined) ?? ''}
                onChange={field.onChange}
                placeholder="No installment term"
                options={[
                  { value: '', label: 'No installment term' },
                  ...financingTerms.map((t) => ({
                    value: t.id,
                    label: `${t.termMonths} mo. — factor ${Number(t.factorRate).toFixed(2)}`,
                  })),
                ]}
              />
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
          <span className="text-zinc-500">
            Item total
            {selectedPriceUse ? (
              <span className="text-zinc-400"> · {selectedPriceUse.name}</span>
            ) : null}
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-zinc-900">
            {isResolvingPrices && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
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
