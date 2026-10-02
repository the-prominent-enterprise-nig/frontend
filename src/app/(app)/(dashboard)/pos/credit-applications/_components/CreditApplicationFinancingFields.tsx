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
  getActivePosConfig,
  type PosPriceUseType,
  type ResolvedPosPrice,
} from '../../_actions/pos-actions'
import { DEFAULT_VAT_RATE } from '../../_actions/pos-constants'
import { Select } from '@/src/components/ui/Select'
import type { FinancingTerm, InstallmentPreview } from '@/src/schema/pos'
import { DOWN_PAYMENT_FLOOR_RATE } from '@/src/libs/constants/financing'

function formatPeso(n: number): string {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

type PaperRecordField = 'lcp' | 'ppdRebate' | 'firstDueDate'
const PAPER_RECORD_FIELDS: PaperRecordField[] = ['lcp', 'ppdRebate', 'firstDueDate']
// Form-only: what the system last wrote into each paper-record field.
const PAPER_AUTO_FILL = 'paperRecordAutoFill'

// The preview's due dates are full timestamps — the sale time plus N months.
// Cutting the ISO string at 10 characters takes the UTC date, which before
// 8am in the Philippines is still yesterday's. The local date is the one the
// customer is told.
function toDateInputValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
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
  /** Scenario 64 item 27 (client, 2026-09-30) — PROPOSED PURCHASE AND
   *  INSTALLMENT is not optional, and Price Use and Term are part of it.
   *  Off by default: the Edit modal reuses this component on a `.partial()`
   *  schema, where demanding both would make every existing draft
   *  uneditable. */
  required?: boolean
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
  required = false,
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

  // Mirrors checkout: prices are tax-exclusive unless the tenant says
  // otherwise, in which case the list price already carries the tax.
  const [inclusivePricing, setInclusivePricing] = useState(false)
  useEffect(() => {
    getActivePosConfig().then((res) => {
      if (res.success && res.data) {
        setInclusivePricing(res.data.defaultPricingMode === 'inclusive')
      }
    })
  }, [])

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

  // WIP is the default again. Making Price Use required removed the
  // "WIP (default)" row that used to stand in for an unmade choice, which
  // left the field blank on a form where almost every application uses WIP —
  // required and empty, when it could be required and already right.
  //
  // Only ever fills a field that is empty, so a restored draft or an edit
  // keeps whatever it already carries. `required` scopes this to the create
  // form; the edit modal must not quietly re-point an application's pricing.
  useEffect(() => {
    if (!required || !wipTypeId || priceUseTypeId) return
    setValue('priceUseTypeId' as Path<T>, wipTypeId as never, { shouldDirty: false })
  }, [required, wipTypeId, priceUseTypeId, setValue])

  // Keeps the full resolved record (not just price) — priceListItemId and
  // downPayment are the curated rate-card fields (Scenario 15, Part 5),
  // needed below to seed Down Payment from the real rate card instead of a
  // generic 10% floor, and to source the monthly installment/total payable
  // preview from the rate card instead of the generic factorRate formula.
  const [resolvedItems, setResolvedItems] = useState<Record<string, ResolvedPosPrice | null>>({})
  const [isResolvingPrices, setIsResolvingPrices] = useState(false)

  useEffect(() => {
    if (!effectivePriceUseTypeId || itemIds.length === 0) {
      setResolvedItems({})
      return
    }
    let cancelled = false
    setIsResolvingPrices(true)
    resolvePosPrices(effectivePriceUseTypeId, itemIds, branchId ?? undefined).then((res) => {
      if (cancelled) return
      setIsResolvingPrices(false)
      setResolvedItems(res.data ?? {})
    })
    return () => {
      cancelled = true
    }
    // itemIdsKey rather than itemIds — a fresh array identity every render
    // would re-fire this on every keystroke elsewhere in the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePriceUseTypeId, itemIdsKey, branchId])

  // Only price-list prices count. The old fallback to `estimatedPrice` — the
  // flat Item.sellingPrice the item picker seeds — made the total look right
  // for an item that is on no active list under the chosen Price Use, so
  // switching Price Use appeared to leave some items unchanged when in fact
  // they had never been priced from a list at all. Worse, it showed a figure
  // the server now refuses outright (Scenario 64 item 21), so the form
  // promised a price the submit could not honour.
  const estimatedTotal = (items ?? []).reduce((sum, i) => {
    const resolved = i.itemId ? resolvedItems[i.itemId] : undefined
    return sum + (resolved ? Number(resolved.price) : 0)
  }, 0)

  // Counted, not named — the row's own label lives in the item field above,
  // and widening this component's generic just to read it is not worth it.
  // Only meaningful once resolution has settled.
  const unpricedCount = isResolvingPrices
    ? 0
    : (items ?? []).filter((i) => i.itemId && !resolvedItems[i.itemId]).length

  // The curated per-SKU down payment is deliberately no longer summed or
  // used — Scenario 64 item 22 (client, 2026-09-29): the down payment is 30%
  // of the sale amount, full stop. Those rate-card figures were priced
  // against the old 10% policy and now sit below the floor, so reading them
  // pre-filled a value the form then rejected. Only the down-payment column
  // is ignored; priceListItemId still drives the monthly-installment
  // preview below and the real figures saved on submit.
  const resolvedItemsList = itemIds.map((id) => resolvedItems[id])
  // The live preview's single previewInstallment() call only takes one
  // priceListItemId, so curation there is scoped to the common single-item
  // application — a multi-item bundle keeps the generic preview on screen,
  // same as before. (The final numbers actually saved on submit ARE
  // curated for a fully-curated multi-item bundle too — that's done
  // server-side in resolveFinancing(), which sums each item's own curated
  // term instead of needing one shared priceListItemId.)
  const soloPriceListItemId =
    resolvedItemsList.length === 1
      ? (resolvedItemsList[0]?.priceListItemId ?? undefined)
      : undefined

  // Checkout measures its own 10% against the TAX-EFFECTIVE line amount,
  // while these prices come straight off the price list. Under exclusive
  // pricing that makes the sale's floor ~12% higher than the application's,
  // so an application approved at exactly its own floor was rejected at the
  // till ("down payment must be at least the floor % of its sale amount") on an
  // application the server had already accepted. Work the floor out on the
  // same basis the sale will use, so what is approved is sellable.
  //
  // The stricter basis is used even though a tax-exempt customer would be
  // charged the lower one: erring high means the collector takes a little
  // more up front, which never blocks a sale, while erring low blocks it
  // outright.
  const floorBasis = inclusivePricing
    ? estimatedTotal
    : estimatedTotal * (1 + DEFAULT_VAT_RATE.rate / 100)
  const downPaymentFloor = floorBasis * DOWN_PAYMENT_FLOOR_RATE

  // The floor is checked in the schema, which can only see form state — so
  // both figures have to live there too, not just in this component.
  useEffect(() => {
    setValue('resolvedItemTotal' as Path<T>, estimatedTotal as never, { shouldDirty: false })
    setValue('downPaymentFloor' as Path<T>, downPaymentFloor as never, { shouldDirty: false })
  }, [estimatedTotal, downPaymentFloor, setValue])

  // Seed Down Payment with the curated rate-card down payment when the
  // whole bundle resolved to one (real NIG rate card figure, e.g. ₱3,590 —
  // not necessarily 10%), falling back to the 10% floor as a real value
  // rather than a greyed-out hint (review feedback, 2026-09-19) when no
  // curated figure applies. The hint vanished the moment anything was
  // typed, so nothing on screen held the collector to the minimum and the
  // first genuine check was a generic banner after submit. Re-seeds when
  // the term or the seed value changes, but never overwrites a figure
  // already entered — the collector is free to take more up front, and the
  // schema refuses less.
  // Scenario 64 item 22 (client, 2026-09-29): the down payment is 30% of the
  // sale amount, and the rate card's own downPayment column is no longer
  // read. Those curated figures were priced against the old 10% policy, so
  // seeding from them pre-filled a value the 30% floor then rejected — on a
  // 21,010 item the form offered 4,620 (22%) and immediately called it wrong.
  // The rate card's monthlyInstallment still drives the schedule; only its
  // down-payment column is ignored. Checkout does the same, so the figure
  // approved here is the figure the till will ask for.
  const seedDownPayment = downPaymentFloor
  const seededForRef = useRef<string | null>(null)
  // The exact string this component last wrote. Changing the Price Use moves
  // the item total, and therefore the floor — a figure we seeded should
  // follow it, but one the collector typed must not be overwritten, so the
  // two cases are told apart by value rather than by guessing.
  const lastSeededValueRef = useRef<string | null>(null)
  useEffect(() => {
    if (!financingTermId || seedDownPayment <= 0) return
    const key = `${financingTermId}:${seedDownPayment.toFixed(2)}`
    if (seededForRef.current === key) return
    seededForRef.current = key

    const current = downPaymentInput?.trim()
    const isOurs = !current || current === lastSeededValueRef.current
    if (!isOurs) return

    const seeded = seedDownPayment.toFixed(2)
    lastSeededValueRef.current = seeded
    setValue('downPayment' as Path<T>, seeded as never, { shouldValidate: true })
  }, [financingTermId, seedDownPayment, downPaymentInput, setValue])

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
      previewInstallment({
        totalAmount: estimatedTotal,
        downPayment,
        financingTermId,
        priceListItemId: soloPriceListItemId,
      }).then((res) => {
        if (cancelled) return
        setPreviewLoading(false)
        if (res.success && res.data) {
          setPreview(res.data)
        } else {
          setPreview(null)
          setPreviewError(res.error ?? 'Could not compute the installment preview')
        }
      })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [estimatedTotal, financingTermId, downPaymentInput, soloPriceListItemId])

  const selectedTerm = financingTerms.find((t) => t.id === financingTermId)
  // Labels the total with whichever Price Use it was actually priced under,
  // including the WIP default, so a changed dropdown visibly changes the
  // number instead of silently doing nothing.
  const selectedPriceUse = priceUseTypes.find((t) => t.id === effectivePriceUseTypeId)
  // Scenario 64 item 27 — the mockup shades PROPOSED PURCHASE AND
  // INSTALLMENT "read only from POS draft": the figures come from the system,
  // not from a transcriber re-keying them. Three of them already exist once
  // this block has resolved prices and a term, so they are filled in here.
  //
  //   LCP            the resolved item total. This is what the app has always
  //                  called listedCashPrice — checkout passes the very same
  //                  group total into InstallmentAccount.listedCashPrice — so
  //                  what LCP means is answered by the codebase rather than
  //                  guessed at.
  //   First due date the first line of the installment schedule the preview
  //                  already computes and shows below.
  //   PPD rebate     the curated rate card's own PriceListItemTerm.ppd, which
  //                  the preview endpoint already returns. Absent on the
  //                  generic factor-rate path, where no rate card exists to
  //                  quote one — left blank there rather than filled with 0,
  //                  which would claim a rebate of nothing.
  //
  // A filled-in figure follows the item and term it came from, but only
  // while it is still the system's: a transcriber who typed a figure off the
  // paper has overridden the system on purpose, and the paper is the source
  // of truth. Filling only EMPTY fields, as this used to, left the first
  // figure behind for good — change the item and LCP kept the old item's
  // price; change the term and the PPD rebate kept the old term's.
  //
  // So the value last written into each field is remembered, and a field
  // that is empty or still holds it is the system's to refresh — or to clear,
  // when the new item or term has no such figure. The memory lives in form
  // state rather than a ref because the whole form is stashed and restored
  // around "+ New customer"; a ref would come back empty and treat every
  // restored figure as typed. It is not in the schema, so validation strips
  // it and it never reaches the server.
  const lcpValue = useWatch({ control, name: 'lcp' as Path<T> }) as string | undefined
  const ppdValue = useWatch({ control, name: 'ppdRebate' as Path<T> }) as string | undefined
  const firstDueValue = useWatch({ control, name: 'firstDueDate' as Path<T> }) as string | undefined
  const autoFilled = useWatch({ control, name: PAPER_AUTO_FILL as Path<T> }) as
    | Partial<Record<PaperRecordField, string>>
    | undefined

  useEffect(() => {
    // `required` is true only on the create form, the only schema that has
    // these fields at all.
    if (!required) return
    const current: Record<PaperRecordField, string> = {
      lcp: lcpValue ?? '',
      ppdRebate: ppdValue ?? '',
      firstDueDate: firstDueValue ?? '',
    }
    const system: Record<PaperRecordField, string> = {
      lcp: estimatedTotal > 0 ? String(estimatedTotal) : '',
      ppdRebate: preview?.ppd != null ? String(preview.ppd) : '',
      firstDueDate: preview?.lines?.[0]?.dueDate ? toDateInputValue(preview.lines[0].dueDate) : '',
    }
    const nextAutoFilled = { ...autoFilled }
    let autoFilledChanged = false
    for (const field of PAPER_RECORD_FIELDS) {
      const isSystems = current[field] === '' || current[field] === (autoFilled?.[field] ?? '')
      if (!isSystems) continue
      if (current[field] !== system[field]) {
        setValue(field as Path<T>, system[field] as never, { shouldDirty: false })
      }
      if ((autoFilled?.[field] ?? '') !== system[field]) {
        nextAutoFilled[field] = system[field]
        autoFilledChanged = true
      }
    }
    if (autoFilledChanged) {
      setValue(PAPER_AUTO_FILL as Path<T>, nextAutoFilled as never, { shouldDirty: false })
    }
    // Deliberately not depending on the current values: this runs when the
    // system's own figures change, not on every keystroke in the fields it
    // fills.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [required, estimatedTotal, preview, setValue])

  const downPaymentError = (errors.downPayment as { message?: string } | undefined)?.message
  const priceUseError = (errors.priceUseTypeId as { message?: string } | undefined)?.message
  const financingTermError = (errors.financingTermId as { message?: string } | undefined)?.message

  return (
    <div className="space-y-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-zinc-400" />
        <h3 className="text-sm font-medium text-zinc-700">Price Use &amp; Financing</h3>
        {!required && <span className="text-xs text-zinc-400">(optional)</span>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">
            Price Use {required && <span className="text-red-500">*</span>}
          </label>
          <Controller
            name={'priceUseTypeId' as Path<T>}
            control={control}
            render={({ field }) => (
              <Select
                value={(field.value as string | undefined) ?? ''}
                onChange={field.onChange}
                placeholder={required ? 'Select a Price Use' : 'WIP (default)'}
                options={[
                  ...(required ? [] : [{ value: '', label: 'WIP (default)' }]),
                  ...priceUseTypes.map((t) => ({ value: t.id, label: t.name })),
                ]}
              />
            )}
          />
          {priceUseError && <p className="mt-1 text-xs text-red-600">{priceUseError}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">
            Financing Term {required && <span className="text-red-500">*</span>}
          </label>
          <Controller
            name={'financingTermId' as Path<T>}
            control={control}
            render={({ field }) => (
              <Select
                value={(field.value as string | undefined) ?? ''}
                onChange={field.onChange}
                placeholder={required ? 'Select a term' : 'No installment term'}
                options={[
                  ...(required ? [] : [{ value: '', label: 'No installment term' }]),
                  ...financingTerms.map((t) => ({
                    value: t.id,
                    // Just the term. The factor is a financing multiplier
                    // (1.08 = 8% markup on the financed amount over the whole
                    // term, not per year) — meaningful to whoever configures
                    // the rate card under POS Settings → Financing Terms,
                    // which is where it still shows, but noise to the person
                    // taking an application. Checkout's own term selector
                    // never showed it either. The numbers it drives are
                    // already on screen in the breakdown below: amount
                    // financed, monthly installment and total payable.
                    label: `${t.termMonths} months`,
                  })),
                ]}
              />
            )}
          />
          {financingTermError && <p className="mt-1 text-xs text-red-600">{financingTermError}</p>}
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
                placeholder={downPaymentFloor > 0 ? `Min. ${formatPeso(downPaymentFloor)}` : '0.00'}
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
        {unpricedCount > 0 && (
          <p className="mt-2 text-xs text-amber-700">
            {unpricedCount === 1 ? 'An item is' : `${unpricedCount} items are`} not on an active
            price list for{' '}
            {selectedPriceUse ? `“${selectedPriceUse.name}”` : 'the default price list'} — price
            {unpricedCount === 1 ? ' it' : ' them'} in Inventory, or choose a different Price Use.
            Submitting will be rejected until then.
          </p>
        )}
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
              {/* The app's own vocabulary, from InstallmentAccount: PNV is
                  MI x term, and Total Price adds the down payment back.
                  Every application becomes one of those contracts, and it
                  used to stop at PNV under the name "Total payable" — so the
                  figure quoted at intake was smaller than the one the
                  customer's contract would show, by exactly the down payment
                  they had just been asked for. Nothing is recomputed here:
                  preview.totalPayable IS the PNV the backend already stores.
                  (computeFinancing(): totalPrice = pnv + downPayment.) */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">PNV (monthly x term)</span>
                <span className="text-zinc-700">{formatPeso(preview.totalPayable)}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-zinc-700">Total price</span>
                <span className="text-prominent-purple-700">
                  {formatPeso(preview.totalPayable + (parseFloat(downPaymentInput ?? '') || 0))}
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
