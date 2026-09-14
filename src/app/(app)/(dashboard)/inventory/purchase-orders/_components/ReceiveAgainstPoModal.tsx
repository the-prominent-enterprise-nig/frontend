'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { PackageCheck, X } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import Tooltip from '@/src/components/ui/Tooltip'
import { locationLabel } from '@/src/libs/format/locationLabel'
import { type PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'
import { receiveStock } from '../../goods-receiving/_actions/receive-stock'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { MONO, PLEX } from './procurementTokens'
import { DeliveryDetailsPanel, DR_FIELD_ID } from './receive-po/DeliveryDetailsPanel'
import { ReceiptTotalsPanel } from './receive-po/ReceiptTotalsPanel'
import { ReceiveActionBar } from './receive-po/ReceiveActionBar'
import { ReceiveChecksCard } from './receive-po/ReceiveChecksCard'
import { ReceiveLineRow } from './receive-po/ReceiveLineRow'
import { itemTitle } from './receive-po/itemTitle'
import {
  capQuantity,
  collectBlockers,
  collectWarnings,
  isDuplicateSerial,
  lineIssues,
  remainingOf,
  type Blocker,
  type IssueFix,
  type IssueLine,
} from './receive-po/receiveIssues'
import {
  ReceivePoFormSchema,
  type LineDrawer,
  type ReceivePoFormValues,
} from './receive-po/receiveSchema'
import { fmtPeso, receiptTotals } from './receive-po/receiveTotals'
import { LINE_GRID, PANEL } from './receive-po/receiveTokens'

type Props = {
  po: PurchaseOrderSummary | null
  onClose: () => void
  /** Fired once the receipt has posted, so the list behind can refresh. The
   * screen closes itself immediately after — there is no posted-receipt step
   * to read, the toast is the confirmation. */
  onPosted: () => void
  /** Unit cost is sensitive pricing data — hidden from Branch Manager/Stock
   * Controller, restricted to Business Owner/Accountant (Scenario 05
   * followup). Server-side enforcement in receiveStock() is the real guard. */
  canViewCost: boolean
}

const STATUS_LABEL: Record<PurchaseOrderSummary['status'], string> = {
  draft: 'Draft',
  approved: 'Approved',
  sent: 'Sent',
  partially_received: 'Partial',
  fully_received: 'Received',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

export function ReceiveAgainstPoModal({ po, onClose, onPosted, canViewCost }: Props) {
  // Scenario 27 — goods are always received into one of the real warehouses
  // now, never a branch's own local stock, so this is unconditionally the
  // standalone-only list.
  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup', 'standalone'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active', standaloneOnly: true }),
    enabled: !!po,
    staleTime: 5 * 60 * 1000,
  })
  const warehouses = warehousesQuery.data?.data?.data ?? []

  const [submitted, setSubmitted] = useState(false)
  const [drawers, setDrawers] = useState<Record<number, LineDrawer>>({})
  const [editingPricing, setEditingPricing] = useState<Record<number, boolean>>({})

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<ReceivePoFormValues>({
    resolver: zodResolver(ReceivePoFormSchema),
    defaultValues: { warehouseId: '', deliveryReceiptNumber: '', lines: [] },
  })

  const watched = watch()
  // NOT memoised, deliberately. `watch()` shallow-copies the form values, so
  // `watched.lines` is the same array instance every render while setValue
  // mutates the objects inside it. Anything derived from it with a useMemo
  // keyed on that reference computes once and then freezes — which is how the
  // checks card came to report "2 of 2 serial numbers still missing" for
  // serials that were typed, visible and about to post fine. Every derivation
  // below is therefore a plain expression; they are all O(lines) over a
  // handful of rows.
  const lines = watched.lines ?? []
  const poLines = useMemo(() => po?.lines ?? [], [po])

  // ─── Reset when a different PO opens ──────────────────────────────────────
  useEffect(() => {
    if (!po) return
    setSubmitted(false)
    setEditingPricing({})
    // Serial-tracked lines start expanded: every PO line is fixed and known
    // upfront, so staff shouldn't have to hunt for a hidden control to enter
    // the supplier's serials.
    setDrawers(
      Object.fromEntries(
        po.lines.map((l, i) => [i, l.item?.isSerialTracked ? 'serials' : null] as const)
      )
    )
    reset({
      warehouseId: po.warehouseId ?? '',
      receivedAt: '',
      notes: '',
      deliveryReceiptNumber: '',
      supplierInvoiceNumber: '',
      lines: po.lines.map((l) => {
        const remaining = remainingOf(l)
        return {
          purchaseOrderLineId: l.id,
          itemId: l.itemId,
          quantityReceived: remaining,
          unitCost: Number(l.unitPrice) > 0 ? Number(l.unitPrice) : undefined,
          srp: l.srp != null ? Number(l.srp) : undefined,
          discounts: (l.discounts as unknown[]) ?? undefined,
          taxCode: undefined,
          taxAmount: undefined,
          batchNumber: '',
          qualityHold: false,
          notes: '',
          selected: remaining > 0,
          isSerialTracked: !!l.item?.isSerialTracked,
          // One blank box per unit, explicitly — not left off the object.
          // react-hook-form only writes a value into an input on reset when
          // the reset payload actually carries one for that field; where it
          // finds nothing it adopts whatever the box already holds. This
          // screen is never unmounted (it renders null between POs), so
          // leaving serialNumbers out meant the serials typed for the last PO
          // were still sitting in the boxes when the next one opened.
          serialNumbers: l.item?.isSerialTracked
            ? Array.from({ length: remaining }, () => '')
            : undefined,
        }
      }),
    })
  }, [po, reset])

  // Scenario 46 — unit cost follows SRP through the discount chain, the same
  // rule PurchaseOrderFormFields applies to unit price. Without this the two
  // could disagree on the same line: a receipt showing "3000 less 3% less 500"
  // beside a hand-typed cost of something else is worse than no discount at
  // all, because the numbers look reconciled and aren't.
  const pricingKey = JSON.stringify(lines.map((l) => [l?.srp, l?.discounts]))
  useEffect(() => {
    lines.forEach((line, i) => {
      const srp = Number(line?.srp)
      const chain = (line?.discounts ?? []) as { type?: string; value?: number }[]
      if (!srp || chain.length === 0) return
      const computed = chain.reduce((price, d) => {
        const val = Number(d?.value)
        if (!d?.type || d.value == null || Number.isNaN(val)) return price
        return d.type === 'percentage' ? price * (1 - val / 100) : price - val
      }, srp)
      const next = Math.max(0, Number(computed.toFixed(2)))
      if (next !== Number(line?.unitCost)) {
        setValue(`lines.${i}.unitCost`, next, { shouldValidate: false })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingKey])

  // ─── Derived ──────────────────────────────────────────────────────────────
  const issueLines: IssueLine[] = lines.map((l) => ({
    selected: l.selected,
    quantityReceived: l.quantityReceived,
    isSerialTracked: l.isSerialTracked,
    serialNumbers: l.serialNumbers,
    qualityHold: l.qualityHold,
    notes: l.notes,
  }))

  const labelFor = useMemo(
    () => (index: number) => itemTitle(poLines[index]?.item) || (poLines[index]?.itemId ?? 'Line'),
    [poLines]
  )

  const totals = receiptTotals(
    lines.map((l) => ({
      selected: l.selected,
      quantityReceived: l.quantityReceived,
      unitCost: l.unitCost,
    })),
    po?.supplier ?? ({} as PurchaseOrderSummary['supplier'])
  )

  const blockers = collectBlockers(
    issueLines,
    poLines,
    watched.deliveryReceiptNumber ?? '',
    labelFor
  )

  const warnings = collectWarnings(issueLines, poLines, labelFor)

  if (!po) return null

  const showErrors = submitted

  // ─── Line mutations ───────────────────────────────────────────────────────

  /** Resizes the serial array alongside the quantity: RHF does not clear a
   * hidden index's value when the array shrinks, so a lowered qty otherwise
   * left stale slots that silently failed the length refine. */
  const setQuantity = (index: number, raw: number) => {
    const remaining = remainingOf(poLines[index])
    const { qty, capped } = capQuantity(raw, remaining)
    const current = lines[index]
    const serials = (current?.serialNumbers ?? []).slice(0, qty)
    while (current?.isSerialTracked && serials.length < qty) serials.push('')

    setValue(`lines.${index}.quantityReceived`, qty, { shouldValidate: showErrors })
    setValue(`lines.${index}.selected`, qty > 0, { shouldValidate: false })
    if (current?.isSerialTracked) {
      setValue(`lines.${index}.serialNumbers`, serials, { shouldValidate: showErrors })
    }

    if (capped) {
      showToast({
        title: `Capped at ${remaining}`,
        description: 'You cannot receive more than the PO remainder.',
        status: 'warning',
      })
    }
  }

  const toggleSelected = (index: number) => {
    const remaining = remainingOf(poLines[index])
    if (remaining <= 0) return
    if (lines[index]?.selected) {
      setValue(`lines.${index}.selected`, false, { shouldValidate: false })
      setValue(`lines.${index}.quantityReceived`, 0, { shouldValidate: false })
      setValue(`lines.${index}.serialNumbers`, lines[index]?.isSerialTracked ? [] : undefined, {
        shouldValidate: false,
      })
      return
    }
    setValue(`lines.${index}.selected`, true, { shouldValidate: false })
    setQuantity(index, remaining)
  }

  const setSerial = (index: number, unitIndex: number, value: string) => {
    const next = (lines[index]?.serialNumbers ?? []).slice()
    while (next.length <= unitIndex) next.push('')
    next[unitIndex] = value
    setValue(`lines.${index}.serialNumbers`, next, { shouldValidate: showErrors })
  }

  const toggleQualityHold = (index: number) => {
    const next = !lines[index]?.qualityHold
    setValue(`lines.${index}.qualityHold`, next, { shouldValidate: false })
    // Dropping the hold drops its reason with it — a stale explanation on an
    // un-held line would post as a plain line note saying the opposite.
    if (!next) setValue(`lines.${index}.notes`, '', { shouldValidate: false })
  }

  const openDrawer = (index: number, drawer: LineDrawer) =>
    setDrawers((prev) => ({ ...prev, [index]: drawer }))

  const receiveAllRemaining = () => {
    poLines.forEach((poLine, i) => {
      const remaining = remainingOf(poLine)
      if (remaining > 0) setQuantity(i, remaining)
    })
    showToast({ title: 'All remaining quantities filled', status: 'success' })
  }

  const clearAllQuantities = () => {
    poLines.forEach((_, i) => {
      setValue(`lines.${i}.quantityReceived`, 0, { shouldValidate: false })
      setValue(`lines.${i}.selected`, false, { shouldValidate: false })
      if (lines[i]?.isSerialTracked) {
        setValue(`lines.${i}.serialNumbers`, [], { shouldValidate: false })
      }
    })
  }

  /** Takes the receiver to whatever a blocker is complaining about — naming a
   * problem without moving them to it is most of the way to not reporting it. */
  const goToFix = (blocker: Blocker) => {
    setSubmitted(true)
    if (blocker.fix === 'dr') {
      document.getElementById(DR_FIELD_ID)?.focus()
      return
    }
    if (blocker.lineIndex == null) return
    applyLineFix(blocker.lineIndex, blocker.fix)
  }

  const applyLineFix = (index: number, fix?: IssueFix) => {
    if (fix === 'serials') openDrawer(index, 'serials')
    if (fix === 'qty') setQuantity(index, remainingOf(poLines[index]))
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  /** Posts straight from the entry screen — there is no review step. The two
   * gates below are all that stand between this and a stock movement that can
   * only be undone with a debit memo, so neither may fail silently. */
  const receiveNow = async () => {
    setSubmitted(true)
    if (blockers.length > 0) {
      showToast({
        title: `${blockers.length} ${blockers.length === 1 ? 'issue' : 'issues'} must be resolved first`,
        description: blockers[0].text,
        status: 'error',
      })
      return
    }
    // Belt and braces: the checks card is derived from watched values, the
    // resolver is the thing the post actually has to satisfy — and for missing
    // serials it is the ONLY thing, since those are kept out of the checks
    // card. Failing silently here would look like a dead button.
    if (!(await trigger())) {
      showToast({
        title: 'Some lines still need attention',
        description: 'Check the highlighted quantities and serial numbers.',
        status: 'error',
      })
      return
    }
    void handleSubmit(post)()
  }

  async function post(data: ReceivePoFormValues) {
    if (!po) return
    const result = await receiveStock({
      warehouseId: data.warehouseId,
      applicationType: 'new_stock',
      receivedAt: data.receivedAt || undefined,
      notes: data.notes || undefined,
      deliveryReceiptNumber: data.deliveryReceiptNumber || undefined,
      supplierInvoiceNumber: data.supplierInvoiceNumber || undefined,
      supplierId: po.supplier.id,
      // Unit costs are what the supplier charges per unit, i.e. VAT-inclusive,
      // so the amount is carved out of them rather than added on top. Always
      // explicit so the server never falls back to deriving VAT nobody entered.
      vatTreatment: 'inclusive' as const,
      lines: data.lines
        .filter((l) => l.selected && l.quantityReceived > 0)
        .map((l) => ({
          purchaseOrderLineId: l.purchaseOrderLineId,
          itemId: l.itemId,
          quantityReceived: l.quantityReceived,
          unitCost: l.unitCost,
          srp: l.srp,
          discounts: l.discounts && l.discounts.length > 0 ? l.discounts : undefined,
          taxCode: l.taxCode || undefined,
          taxAmount: l.taxAmount,
          batchNumber: l.batchNumber || undefined,
          qualityHold: l.qualityHold,
          notes: l.notes || undefined,
          ...(l.serialNumbers && l.serialNumbers.length > 0 && { serialNumbers: l.serialNumbers }),
        })),
    })

    if (!result.success || !result.data) {
      showToast({
        title: 'Failed to receive stock',
        description: result.message || result.error,
        status: 'error',
      })
      return
    }

    showToast({ title: 'Receipt posted · inventory updated', status: 'success' })
    onPosted()
    onClose()
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const destination = locationLabel(po.warehouse)
  // Blank is a real state here — the field is not defaulted, and an empty
  // value posts with the server's own timestamp — so the recap says nothing
  // rather than claiming a date the form does not hold.
  const dateReceivedEntered = watched.receivedAt
    ? new Date(watched.receivedAt).toLocaleDateString('en-PH')
    : ''

  const openLineCount = poLines.filter((l) => remainingOf(l) > 0).length

  return (
    // absolute, not fixed: the working surface fills the content column (the
    // app shell's `main` is the positioning frame) so the nav sidebar and top
    // bar stay usable while a delivery is being received. Same shell as
    // CreatePoModal and PoDetailModal.
    <div
      className={`${PLEX} absolute inset-0 z-50 flex flex-col overflow-y-auto bg-[#f2f2f3] text-[#17171c]`}
    >
      {/* Header */}
      {/* pb matches pt: the bottom padding used to come from the progress bar
          that sat under this block, so removing it left the supplier line
          against the border. */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-[#e4e4e9] bg-white px-4 py-3.5 lg:px-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 flex-col gap-1">
            <div className={`${MONO} text-[10.5px] uppercase tracking-[.08em] text-[#a3a3b2]`}>
              Purchase Orders › {po.code} › Receive
            </div>
            <h2 className="text-[21px] font-semibold tracking-[-.02em]">
              Receive stock against PO
            </h2>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`${MONO} text-[12.5px] font-semibold`}>{po.code}</span>
              <span className="text-[#d3d3db]">·</span>
              <span className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#eaf0fb] text-[11px] font-semibold text-[#1f4b99]">
                  {po.supplier.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-[12.5px] font-medium">{po.supplier.name}</span>
                {po.supplier.taxId && (
                  <span className={`${MONO} text-[10.5px] text-[#8b8b9b]`}>
                    TIN {po.supplier.taxId}
                  </span>
                )}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-[11.5px] font-medium ${
                  po.status === 'fully_received'
                    ? 'bg-[#e7f5ef] text-[#0b6644]'
                    : 'bg-[#fdf3e7] text-[#8a4b06]'
                }`}
              >
                <span
                  className={`inline-block h-[5px] w-[5px] rounded-full ${
                    po.status === 'fully_received' ? 'bg-[#0f7b52]' : 'bg-[#d18b1d]'
                  }`}
                />
                {STATUS_LABEL[po.status]}
              </span>
            </div>
          </div>

          <Tooltip label="Close" side="bottom" align="end">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8b8b9b] hover:bg-[#f1f1f4] hover:text-[#17171c]"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col gap-3.5 px-3.5 py-4 lg:px-5">
        <>
          <div
            className={`grid items-stretch gap-3.5 ${
              canViewCost ? 'lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]' : 'grid-cols-1'
            }`}
          >
            <DeliveryDetailsPanel
              control={control}
              errors={errors}
              po={po}
              warehouses={warehouses}
              showErrors={showErrors}
              deliveryReceiptNumber={watched.deliveryReceiptNumber ?? ''}
              recap={[
                destination,
                dateReceivedEntered,
                (watched.deliveryReceiptNumber ?? '').trim() || 'No DR yet',
                (watched.supplierInvoiceNumber ?? '').trim(),
              ]
                .filter(Boolean)
                .join(' · ')}
            />
            {canViewCost && <ReceiptTotalsPanel totals={totals} />}
          </div>

          {/* Ungated on purpose, unlike the inline field errors: this card
                is the "what is stopping me" panel, and holding its contents
                back until the receiver has already tried to post makes it
                answer the question too late to be worth asking. Painting an
                untouched input red is a different matter — that stays gated. */}
          <ReceiveChecksCard blockers={blockers} warnings={warnings} onFix={goToFix} />

          {/* Line items */}
          <div className={PANEL}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeef1] px-4.5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="text-[13.5px] font-semibold">Line items</span>
                <span className={`${MONO} text-[11px] text-[#8b8b9b]`}>
                  {totals.lines} of {openLineCount} open lines · {totals.units} units
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={receiveAllRemaining}
                  className="rounded-[7px] border border-[#ddd0f7] bg-[#f1ebfb] px-2.5 py-1.5 text-[12.5px] text-[#3f1490] hover:bg-[#e8ddfa]"
                >
                  Receive all remaining
                </button>
                <button
                  type="button"
                  onClick={clearAllQuantities}
                  className="rounded-[7px] border border-[#d3d3db] bg-white px-2.5 py-1.5 text-[12.5px] text-[#5b5b6b] hover:border-[#a3a3b2] hover:text-[#17171c]"
                >
                  Clear quantities
                </button>
              </div>
            </div>

            {poLines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <PackageCheck className="mb-2 h-8 w-8 text-[#d3d3db]" />
                <p className="text-[13px] text-[#a3a3b2]">No line items on this PO</p>
              </div>
            ) : (
              <>
                <LineTableHead />
                {poLines.map((poLine, index) => {
                  const line = lines[index]
                  if (!line) return null
                  return (
                    <ReceiveLineRow
                      key={poLine.id}
                      control={control}
                      lineIndex={index}
                      line={line}
                      title={labelFor(index)}
                      sku={poLine.item?.sku}
                      ordered={Number(poLine.quantity)}
                      receivedToDate={Number(poLine.receivedQuantity ?? 0)}
                      remaining={remainingOf(poLine)}
                      canViewCost={canViewCost}
                      showErrors={showErrors}
                      issues={lineIssues(issueLines[index], poLine, issueLines, index).filter(
                        (i) => showErrors || i.kind === 'warn'
                      )}
                      drawer={drawers[index] ?? null}
                      editingPricing={!!editingPricing[index]}
                      isDuplicateSerial={(unit) => isDuplicateSerial(issueLines, index, unit)}
                      onToggleSelected={() => toggleSelected(index)}
                      onQtyChange={(raw) => setQuantity(index, raw)}
                      onFillMax={() => setQuantity(index, remainingOf(poLine))}
                      onOpenDrawer={(drawer) => openDrawer(index, drawer)}
                      onToggleEditPricing={() =>
                        setEditingPricing((prev) => ({ ...prev, [index]: !prev[index] }))
                      }
                      onToggleQc={() => toggleQualityHold(index)}
                      onQcReasonChange={(value) =>
                        setValue(`lines.${index}.notes`, value, { shouldValidate: false })
                      }
                      onSerialChange={(unit, value) => setSerial(index, unit, value)}
                      onClearSerials={() =>
                        setValue(
                          `lines.${index}.serialNumbers`,
                          Array.from({ length: line.quantityReceived }, () => ''),
                          { shouldValidate: showErrors }
                        )
                      }
                      onFixIssue={(fix) => applyLineFix(index, fix)}
                    />
                  )
                })}
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-[#e4e4e9] bg-[#fbfbfc] px-4.5 py-3">
              <span className="text-[11.5px] text-[#8b8b9b]">
                Quantities are capped at the PO remainder. Short deliveries stay open for the next
                receipt.
              </span>
              <span className={`${MONO} text-[11.5px] text-[#3d3d4a]`}>
                {totals.units} units{canViewCost && ` · ${fmtPeso(totals.invoice)} invoiced`}
              </span>
            </div>
          </div>
        </>
      </div>

      <ReceiveActionBar
        blockerCount={blockers.length}
        showBlockers={showErrors}
        totals={totals}
        deliveryReceiptNumber={watched.deliveryReceiptNumber ?? ''}
        isSubmitting={isSubmitting}
        onCancel={onClose}
        onPrimary={receiveNow}
      />
    </div>
  )
}

function LineTableHead() {
  return (
    <div
      className={`${MONO} ${LINE_GRID} hidden items-end border-b border-[#eeeef1] bg-[#fbfbfc] px-4.5 py-2.5 text-[10px] uppercase tracking-[.09em] text-[#8b8b9b] lg:grid`}
    >
      <span />
      <span>Item / SKU</span>
      <span className="text-center">Ordered</span>
      {/* Its column is sized to hold this heading on one line — shrinking that
          track wraps it, which reads as two separate column labels. */}
      <span className="whitespace-nowrap text-center">Received to date</span>
      <span className="pr-3 text-center">Remaining</span>
      <span className="text-center">Qty to receive</span>
      <span>Tracking</span>
      <span className="text-center">QC</span>
      <span className="text-right">Line total</span>
    </div>
  )
}
