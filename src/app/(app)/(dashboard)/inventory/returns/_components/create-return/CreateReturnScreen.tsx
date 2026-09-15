'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm, Controller, useWatch, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import { CustomerSearchCombobox } from '@/src/app/(app)/(dashboard)/pos/service-jobs/_components/CustomerSearchCombobox'
import { getCustomerPurchases } from '../../_actions/get-customer-purchases'
import type { CustomerReturnResult } from '../../_actions/create-customer-return'
import {
  CustomerReturnFormSchema,
  RETURN_WINDOW_DAYS,
  type CustomerPurchase,
  type CustomerReturnFormValues,
  type CustomerReturnLineFormValues,
} from '@/src/schema/inventory/returns'
import type { WarehouseSummary } from '@/src/schema/inventory/warehouses'
import type { ApiResponse } from '@/src/libs/api/client'
import PurchaseRow, { daysSince } from './PurchaseRow'
import SettlementLedger from './SettlementLedger'
import ReturnActionBar from './ReturnActionBar'
import PostedDialog from './PostedDialog'
import { printReturnSlip } from './printReturnSlip'
import { collectGaps } from './returnIssues'
import { computeSettlement } from './returnTotals'
import { CAPTION, INPUT, PANEL, PLEX } from './returnTokens'

type Props = {
  onClose: () => void
  onSubmit: (values: CustomerReturnFormValues) => Promise<ApiResponse<CustomerReturnResult>>
  isSubmitting: boolean
  warehouseOptions: WarehouseSummary[]
}

/** The first human-readable message anywhere in RHF's nested error tree. */
function firstErrorMessage(node: unknown): string | undefined {
  if (!node || typeof node !== 'object') return undefined
  const maybe = node as { message?: unknown }
  if (typeof maybe.message === 'string' && maybe.message) return maybe.message
  for (const value of Object.values(node as Record<string, unknown>)) {
    const found = firstErrorMessage(value)
    if (found) return found
  }
  return undefined
}

/** A ticked purchase, as the line it becomes. Nothing is derived twice: the
 *  price, the unit and the invoice all come off the purchase that was ticked. */
function lineFrom(purchase: CustomerPurchase): CustomerReturnLineFormValues {
  return {
    itemId: purchase.itemId,
    itemName: purchase.itemName ?? undefined,
    itemSku: purchase.itemSku ?? undefined,
    quantity: Number(purchase.quantity),
    soldQuantity: Number(purchase.quantity),
    unitPrice: Number(purchase.unitPrice),
    disposition: '',
    reasonCode: '',
    serialNumberId: purchase.serialNumberId ?? undefined,
    serialNumber: purchase.serialNumber ?? undefined,
    sourcePosTransactionLineId: purchase.id,
    sourceReceiptNumber: purchase.salesInvoiceNumber ?? purchase.transactionNumber,
  }
}

/**
 * Who brought it back, what they bought, and what happens to each thing.
 *
 * The customer and the branch sit in the page header rather than in a first
 * numbered section, because they are the context everything below is read
 * against — not a step to be completed and left behind. Below them the screen
 * is one list: their own purchases, each of which unfolds into its own
 * decision when ticked. There is no separate lines table to reconcile against
 * the picker, and no stepper to walk back through to fix a quantity.
 */
export default function CreateReturnScreen({
  onClose,
  onSubmit,
  isSubmitting,
  warehouseOptions,
}: Props) {
  const [customerLabel, setCustomerLabel] = useState('')
  const [allTime, setAllTime] = useState(false)
  const [touched, setTouched] = useState(false)
  const [posted, setPosted] = useState<CustomerReturnResult | null>(null)

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<CustomerReturnFormValues>({
    resolver: zodResolver(CustomerReturnFormSchema),
    defaultValues: { warehouseId: '', customerId: '', notes: '', lines: [] },
  })

  const values = useWatch({ control }) as CustomerReturnFormValues
  const customerId = values?.customerId
  const warehouseId = values?.warehouseId ?? ''

  // Preselected only when there is nothing to choose.
  //
  // It cannot go in defaultValues at all — those are read once at mount, while
  // the warehouse list is still in flight. But defaulting to the first option
  // was worse than leaving it blank: the list is alphabetical, so a business
  // owner who can see every branch got "Ajuy" preselected regardless of where
  // they were standing, and the replacement picker then truthfully reported no
  // stock in a branch nobody had chosen.
  const onlyWarehouseId = warehouseOptions.length === 1 ? warehouseOptions[0].id : undefined
  useEffect(() => {
    if (!onlyWarehouseId) return
    if (getValues('warehouseId')) return
    setValue('warehouseId', onlyWarehouseId, { shouldValidate: false })
  }, [onlyWarehouseId, getValues, setValue])

  const purchasesQuery = useQuery({
    queryKey: ['return-customer-purchases', customerId],
    queryFn: () => getCustomerPurchases(customerId as string),
    enabled: !!customerId,
    staleTime: 60 * 1000,
  })
  const purchases = useMemo(() => purchasesQuery.data?.data ?? [], [purchasesQuery.data])

  // Memoized because the `?? []` fallback is a fresh array on every render,
  // which would re-run every memo below on each keystroke.
  const lines = useMemo(() => values?.lines ?? [], [values])
  const gaps = useMemo(() => collectGaps({ ...values, lines }), [values, lines])
  const settlement = useMemo(() => computeSettlement(lines), [lines])

  // Recent purchases lead, because a return is usually of something just
  // bought. Older ones are a click away rather than gone — the window is
  // branch policy, not a rule this screen gets to enforce.
  const recent = useMemo(
    () => purchases.filter((p) => daysSince(p.occurredAt) <= RETURN_WINDOW_DAYS),
    [purchases]
  )
  const visible = allTime ? purchases : recent
  const hiddenCount = purchases.length - recent.length

  const branchName = warehouseOptions.find((w) => w.id === warehouseId)?.branch?.name

  function lineIndexFor(purchaseId: string): number {
    return lines.findIndex((l) => l.sourcePosTransactionLineId === purchaseId)
  }

  function togglePurchase(purchase: CustomerPurchase): void {
    const index = lineIndexFor(purchase.id)
    if (index >= 0) {
      setValue(
        'lines',
        lines.filter((_, i) => i !== index)
      )
      return
    }

    const next = [...lines, lineFrom(purchase)]
    setValue('lines', next)

    // The sale's own documents come along with the first pick — the clerk was
    // retyping a number the form already had, off a receipt it had matched.
    if (!values?.arInvoiceId && purchase.arInvoiceId) {
      setValue('arInvoiceId', purchase.arInvoiceId)
    }
    if (!values?.salesInvoiceNumber) {
      const doc = purchase.salesInvoiceNumber ?? purchase.arInvoiceNumber
      if (doc) setValue('salesInvoiceNumber', doc)
    }
  }

  function patchLine(purchaseId: string, patch: Partial<CustomerReturnLineFormValues>): void {
    const index = lineIndexFor(purchaseId)
    if (index < 0) return
    setValue(
      'lines',
      lines.map((line, i) => (i === index ? { ...line, ...patch } : line))
    )
  }

  /**
   * Schema failures the form has nowhere to show.
   *
   * Most answers now go red in place, but a rejection with no field of its own
   * would leave the Post button doing visibly nothing — the worst possible
   * answer, because it looks identical to a dead button.
   */
  function onInvalid(formErrors: FieldErrors<CustomerReturnFormValues>): void {
    setTouched(true)
    showToast({
      title: 'Not ready to post',
      description:
        gaps[0]?.message ??
        firstErrorMessage(formErrors) ??
        'Something on this return is incomplete.',
      status: 'error',
    })
  }

  async function submit(data: CustomerReturnFormValues): Promise<void> {
    // Belt and braces: a keyboard submit should say why rather than silently
    // doing nothing.
    const current = collectGaps(data)
    if (current.length) {
      setTouched(true)
      showToast({ title: 'Not ready to post', description: current[0].message, status: 'error' })
      return
    }
    try {
      const result = await onSubmit(data)
      if (result.success && result.data) setPosted(result.data)
    } catch (err) {
      // mutateAsync rejects on a thrown server action; without this the screen
      // just sat there as though nothing had been pressed.
      showToast({
        title: 'Could not record the return',
        description: err instanceof Error ? err.message : String(err),
        status: 'error',
      })
    }
  }

  return (
    <div className={`${PLEX} absolute inset-0 z-50 flex flex-col bg-[#f2f2f3] text-[#17171c]`}>
      <form
        onSubmit={handleSubmit(submit, onInvalid)}
        noValidate
        className="flex flex-1 flex-col overflow-hidden"
      >
        <header className="flex shrink-0 flex-wrap items-end justify-between gap-[18px] border-b border-[#e4e4e9] bg-white px-[22px] py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className={CAPTION}>Inventory · Returns</span>
            <h2 className="text-[21px] font-semibold tracking-[-.02em]">Customer return</h2>
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-[9px] md:flex-none">
            <div className="min-w-[240px] flex-1 md:w-[280px] md:flex-none">
              <Controller
                name="customerId"
                control={control}
                render={({ field }) => (
                  <CustomerSearchCombobox
                    value={field.value ?? ''}
                    onSelect={(option) => setCustomerLabel(option.primary)}
                    onChange={(id) => {
                      // Changing who returned it invalidates everything picked
                      // from their history.
                      field.onChange(id)
                      setValue('lines', [])
                      setValue('arInvoiceId', '')
                      setValue('salesInvoiceNumber', '')
                      setTouched(false)
                      if (!id) setCustomerLabel('')
                    }}
                  />
                )}
              />
            </div>
            <Controller
              name="warehouseId"
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  aria-label="Branch taking it back"
                  className={`h-[38px] w-full min-w-[150px] cursor-pointer md:w-auto ${INPUT} ${
                    errors.warehouseId ? 'border-[#b42318]' : ''
                  }`}
                >
                  <option value="">Select branch…</option>
                  {warehouseOptions.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.branch?.name ?? w.name}
                    </option>
                  ))}
                </select>
              )}
            />
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-[13px] overflow-y-auto px-[22px] py-[18px]">
          {!customerId ? (
            <div
              className={`${PANEL} flex flex-col items-center gap-[7px] px-6 py-[52px] text-center`}
            >
              <span className="text-[14.5px] font-semibold">Find the customer</span>
              <span className="max-w-[400px] text-[12.5px] leading-[1.55] text-[#5b5b6b]">
                Their purchase history gives you the item, the serial, the price paid and whether it
                is still inside the return window.
              </span>
            </div>
          ) : (
            <>
              <div className={`${PANEL} overflow-hidden`}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeef1] px-[18px] py-[13px]">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[13.5px] font-semibold">
                      {customerLabel || 'This customer'}
                    </span>
                    <span className="text-[11.5px] text-[#5b5b6b]">
                      Tick what is coming back — each line gets its own decision.
                    </span>
                  </div>
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setAllTime((v) => !v)}
                      className="shrink-0 cursor-pointer rounded-[7px] border border-[#ddd0f7] bg-white px-3 py-[7px] text-[11.5px] font-medium text-[#5b21b6] hover:bg-[#faf7ff]"
                    >
                      {allTime
                        ? `Last ${RETURN_WINDOW_DAYS} days only`
                        : `Show all purchases (${hiddenCount} older)`}
                    </button>
                  )}
                </div>

                {purchasesQuery.isLoading ? (
                  <p className="flex items-center justify-center gap-2 px-[18px] py-10 text-[12.5px] text-[#5b5b6b]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Looking up what they bought…
                  </p>
                ) : visible.length === 0 ? (
                  <p className="px-[18px] py-10 text-center text-[12.5px] text-[#5b5b6b]">
                    {purchases.length === 0
                      ? 'Nothing recorded against this customer yet.'
                      : `Nothing bought in the last ${RETURN_WINDOW_DAYS} days — show all purchases to go further back.`}
                  </p>
                ) : (
                  visible.map((purchase, i) => {
                    const index = lineIndexFor(purchase.id)
                    return (
                      <PurchaseRow
                        key={purchase.id}
                        purchase={purchase}
                        line={index >= 0 ? lines[index] : undefined}
                        warehouseId={warehouseId}
                        showError={touched}
                        first={i === 0}
                        onToggle={() => togglePurchase(purchase)}
                        onChange={(patch) => patchLine(purchase.id, patch)}
                      />
                    )
                  })
                )}
              </div>

              {lines.length > 0 && (
                <SettlementLedger
                  settlement={settlement}
                  notes={values?.notes ?? ''}
                  onNotes={(value) => setValue('notes', value)}
                />
              )}
            </>
          )}
        </div>

        <ReturnActionBar
          settlement={settlement}
          gaps={gaps}
          hasCustomer={!!customerId}
          isSubmitting={isSubmitting}
          onCancel={onClose}
        />
      </form>

      {posted && (
        <PostedDialog
          result={posted}
          settlement={settlement}
          branchName={branchName}
          onPrint={() =>
            printReturnSlip({
              customerName: customerLabel,
              branchName,
              values: getValues(),
              result: posted,
            })
          }
          onClose={onClose}
        />
      )}
    </div>
  )
}
