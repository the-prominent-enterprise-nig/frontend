'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PackagePlus, Plus, X } from 'lucide-react'
import {
  ReceiveStockFormSchema,
  type ReceiveStockFormValues,
} from '@/src/schema/inventory/goods-receiving'
import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'
import type { ApiResponse } from '@/src/libs/api/client'
import type { ItemSummary } from '@/src/schema/inventory/items'
import type { SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import Tooltip from '@/src/components/ui/Tooltip'
import { showToast } from '@/src/components/ui/toast'
import {
  ItemSearchCombobox,
  type ItemSearchMeta,
} from '../../purchase-requests/_components/ItemSearchCombobox'
import { MONO, PLEX, fmtPeso } from '../../purchase-orders/_components/procurementTokens'
import { ReceiveActionBar } from '../../purchase-orders/_components/receive-po/ReceiveActionBar'
import { itemTitle } from '../../purchase-orders/_components/receive-po/itemTitle'
import {
  isDuplicateSerial,
  type IssueFix,
} from '../../purchase-orders/_components/receive-po/receiveIssues'
import type { LineDrawer } from '../../purchase-orders/_components/receive-po/receiveSchema'
import { PoLinkPicker, outstandingOf } from './create-rr/PoLinkPicker'
import { RrDeliveryPanel, type WarehouseOption } from './create-rr/RrDeliveryPanel'
import { RrLineRow } from './create-rr/RrLineRow'
import { collectRrBlockers, rrLineIssues, toIssueLines } from './create-rr/rrChecks'
import { costFromPricing, rrTotals, type RrLine } from './create-rr/rrTotals'
import { PANEL, RR_LINE_GRID } from './create-rr/rrTokens'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ReceiveStockFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  warehouses: WarehouseOption[]
  items: ItemSummary[]
  /** Unit cost is sensitive pricing data — hidden from Branch Manager/Stock
   * Controller, restricted to Business Owner/Accountant (Scenario 05 followup).
   * Server-side enforcement in receiveStock() is the real guard; this just
   * keeps the field out of view for roles who can't set it anyway. */
  canViewCost: boolean
  /** This form always does the same thing underneath (create a GoodsReceipt
   * — a receiving report — and post it to the ledger), but reads oddly as
   * "Receive Stock" when opened from the Receiving Reports list rather than
   * the stock-balances screen it was written for. Let the caller reframe
   * the copy instead of forking the form. */
  title?: string
  subtitle?: string
  submitLabel?: string
  submittingLabel?: string
}

/** What the form payload has no room for but the screen has to know: the item
 * facts behind a line's bare `itemId`. */
type ItemMeta = {
  name: string
  sku?: string
  isSerialTracked: boolean
  costPrice?: number | null
  modelNumber?: string | null
  brand?: { name: string } | null
  primaryCategory?: { name: string; parentCategory?: { name: string } | null } | null
}

const defaultValues: ReceiveStockFormValues = {
  code: '',
  purchaseOrderNumber: '',
  purchaseOrderDate: '',
  supplierId: '',
  withholding: 'none',
  vatTreatment: 'inclusive',
  warehouseId: '',
  applicationType: 'new_stock',
  modeOfTransfer: '',
  receivedAt: '',
  notes: '',
  deliveryReceiptNumber: '',
  supplierInvoiceNumber: '',
  lines: [],
}

const emptyLine = (itemId: string): RrLine => ({
  itemId,
  quantityReceived: 1,
  isFreebie: false,
  qualityHold: false,
  batchNumber: '',
  notes: '',
})

/** A line's stable identity for UI state that must survive re-ordering: the PO
 * line it answers to, or the item itself (the form keeps one manual line per
 * item — adding the same item again adds to the line already there). */
const lineKey = (line: RrLine): string => line.purchaseOrderLineId ?? line.itemId

/**
 * Create Receiving Report — the standalone half of receiving, for a delivery
 * that arrives without being received against a purchase order from the
 * Procurement side.
 *
 * Built on the same parts as that screen (checks card, serial capture, totals,
 * action bar) rather than beside them: both produce the same GoodsReceipt and
 * the same stock movement, and two hand-rolled receiving surfaces is how they
 * came to disagree about what a complete receipt looks like.
 *
 * What's different here is only what a free-standing delivery genuinely adds —
 * the receiver chooses the supplier, the destination and the items, and may
 * link a PO after the fact rather than starting from one.
 */
export default function ReceiveStockModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  warehouses,
  items,
  canViewCost,
  title = 'Receive Stock',
  subtitle = 'Record incoming stock into inventory.',
  submitLabel = 'Receive Stock',
  submittingLabel = 'Receiving…',
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<ReceiveStockFormValues>({
    resolver: zodResolver(ReceiveStockFormSchema),
    defaultValues,
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })

  const [submitted, setSubmitted] = useState(false)
  const [drawers, setDrawers] = useState<Record<string, LineDrawer>>({})
  const [pickedItems, setPickedItems] = useState<Record<string, ItemMeta>>({})
  const [linkedPo, setLinkedPo] = useState<PurchaseOrderSummary | null>(null)
  const [poPickerOpen, setPoPickerOpen] = useState(false)
  const [supplierName, setSupplierName] = useState<string | undefined>(undefined)
  // Remounts the catalogue search after each pick so it resets to empty, ready
  // for the next item — it has no clear-on-select of its own.
  const [searchNonce, setSearchNonce] = useState(0)
  const searchRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (isOpen) return
    reset(defaultValues)
    setSubmitted(false)
    setDrawers({})
    setPickedItems({})
    setLinkedPo(null)
    setPoPickerOpen(false)
    setSupplierName(undefined)
  }, [isOpen, reset])

  const watched = watch()
  // NOT memoised, deliberately. `watch()` shallow-copies the form values, so
  // `watched.lines` is the same array instance every render while setValue
  // mutates the objects inside it — anything derived from it with a useMemo
  // keyed on that reference computes once and then freezes, which is how a
  // checks card comes to report serials as missing that are typed and visible.
  // Every derivation below is a plain expression over a handful of rows.
  const lines = (watched.lines ?? []) as RrLine[]

  const metaFor = (itemId: string): ItemMeta | undefined => {
    if (pickedItems[itemId]) return pickedItems[itemId]
    const item = items.find((candidate) => candidate.id === itemId)
    if (!item) return undefined
    return {
      name: item.name,
      sku: item.sku,
      isSerialTracked: item.isSerialTracked ?? false,
      costPrice: item.costPrice,
      modelNumber: item.modelNumber,
      brand: item.brand,
      primaryCategory: item.primaryCategory,
    }
  }

  const poLineOf = (line: RrLine): PurchaseOrderSummary['lines'][number] | undefined =>
    line.purchaseOrderLineId
      ? linkedPo?.lines.find((candidate) => candidate.id === line.purchaseOrderLineId)
      : undefined

  const contextFor = (index: number) => {
    const line = lines[index]
    const poLine = line ? poLineOf(line) : undefined
    return {
      isSerialTracked: line ? (metaFor(line.itemId)?.isSerialTracked ?? false) : false,
      outstanding: poLine
        ? Math.max(Number(poLine.quantity) - Number(poLine.receivedQuantity ?? 0), 0)
        : null,
      poCode: linkedPo?.code,
    }
  }

  const labelFor = (index: number): string => {
    const line = lines[index]
    if (!line) return 'Line'
    const meta = metaFor(line.itemId)
    return itemTitle(meta) || meta?.name || 'Line'
  }

  const issueLines = toIssueLines(lines, contextFor)
  const totals = rrTotals(watched)
  // ReceiveActionBar speaks the PO screen's totals shape; the two extra flags
  // there are "does this supplier charge/withhold", which on this screen is a
  // choice on the form rather than a fact about the supplier.
  const barTotals = {
    ...totals,
    chargesInputVat: (watched.vatTreatment ?? 'inclusive') !== 'exempt',
    withholdsTax: totals.withheld > 0,
  }

  const blockers = collectRrBlockers(
    {
      supplierId: watched.supplierId,
      warehouseId: watched.warehouseId,
      deliveryReceiptNumber: watched.deliveryReceiptNumber,
      applicationType: watched.applicationType ?? 'new_stock',
      hasPoLink: lines.some((line) => !!line.purchaseOrderLineId),
    },
    issueLines,
    labelFor
  )

  // Unit cost follows SRP through the discount chain, the same rule the PO
  // form and the receive-against-PO screen apply. Without it the two could
  // disagree on the same line: a receipt showing "3000 less 3% less 500"
  // beside a hand-typed cost of something else is worse than no discount at
  // all, because the numbers look reconciled and aren't.
  const pricingKey = JSON.stringify(
    lines.map((line) => [line?.srp, line?.discounts, line?.isFreebie])
  )
  useEffect(() => {
    lines.forEach((line, index) => {
      const next = costFromPricing(line)
      if (next == null || next === Number(line?.unitCost)) return
      setValue(`lines.${index}.unitCost`, next, { shouldValidate: false })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingKey])

  const outstandingNotPulled = useMemo(() => {
    if (!linkedPo) return []
    return linkedPo.lines.filter(
      (poLine) =>
        Math.max(Number(poLine.quantity) - Number(poLine.receivedQuantity ?? 0), 0) > 0 &&
        !lines.some((line) => line.purchaseOrderLineId === poLine.id)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedPo, lines.length])

  if (!isOpen) return null

  const showErrors = submitted

  // ─── Line mutations ───────────────────────────────────────────────────────

  /** Resizes the serial array alongside the quantity: RHF does not clear a
   * hidden index's value when the array shrinks, so a lowered qty otherwise
   * leaves stale slots that silently fail the length refine. */
  function setQuantity(index: number, raw: number): void {
    const qty = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0
    const line = lines[index]
    setValue(`lines.${index}.quantityReceived`, qty, { shouldValidate: showErrors })
    if (!line || !contextFor(index).isSerialTracked) return
    const serials = (line.serialNumbers ?? []).slice(0, qty)
    while (serials.length < qty) serials.push('')
    setValue(`lines.${index}.serialNumbers`, serials, { shouldValidate: showErrors })
  }

  function setSerial(index: number, unitIndex: number, value: string): void {
    const next = (lines[index]?.serialNumbers ?? []).slice()
    while (next.length <= unitIndex) next.push('')
    next[unitIndex] = value
    setValue(`lines.${index}.serialNumbers`, next, { shouldValidate: showErrors })
  }

  function toggleFreebie(index: number): void {
    const next = !lines[index]?.isFreebie
    setValue(`lines.${index}.isFreebie`, next, { shouldValidate: false })
    // The server forces a freebie's cost to 0 whatever is submitted, so the
    // form says the same thing rather than posting a number it knows is void.
    if (next) setValue(`lines.${index}.unitCost`, 0, { shouldValidate: false })
  }

  function toggleQualityHold(index: number): void {
    const next = !lines[index]?.qualityHold
    setValue(`lines.${index}.qualityHold`, next, { shouldValidate: false })
    // Dropping the hold drops its reason with it — a stale explanation on an
    // un-held line would post as a plain line note saying the opposite.
    if (!next) setValue(`lines.${index}.notes`, '', { shouldValidate: false })
  }

  /** Opens the catalogue picker — SearchCombobox's closed state is a button,
   * so clicking it is what puts the caret in the search. */
  function openItemSearch(): void {
    searchRef.current?.querySelector('button')?.click()
  }

  function openDrawer(key: string, drawer: LineDrawer): void {
    setDrawers((prev) => ({ ...prev, [key]: drawer }))
  }

  function rememberItem(itemId: string, meta: ItemMeta): void {
    setPickedItems((prev) => ({ ...prev, [itemId]: meta }))
  }

  function addFromCatalog(option: SearchComboboxOption): void {
    const meta = option.meta as ItemSearchMeta | undefined
    const isSerialTracked = meta?.isSerialTracked ?? false
    rememberItem(option.id, {
      name: option.primary,
      sku: option.secondary,
      isSerialTracked,
      costPrice: meta?.costPrice ?? null,
    })
    setSearchNonce((n) => n + 1)

    // One manual line per item: scanning the same box twice means two units,
    // not two lines that later disagree about cost.
    const existing = lines.findIndex(
      (line) => line.itemId === option.id && !line.purchaseOrderLineId
    )
    if (existing >= 0) {
      setQuantity(existing, (lines[existing]?.quantityReceived ?? 0) + 1)
      showToast({ title: 'Quantity increased', description: option.primary, status: 'success' })
      return
    }

    append({
      ...emptyLine(option.id),
      unitCost: meta?.costPrice ?? undefined,
      ...(isSerialTracked && { serialNumbers: [''] }),
    })
    // Serial-tracked lines open their capture drawer straight away rather than
    // making the receiver hunt for it — it is the one thing that will block the
    // post, and the units are in their hands right now.
    if (isSerialTracked) openDrawer(option.id, 'serials')
  }

  function pullPoLines(): void {
    if (!linkedPo) return
    let pulled = 0
    linkedPo.lines.forEach((poLine) => {
      const outstanding = Math.max(
        Number(poLine.quantity) - Number(poLine.receivedQuantity ?? 0),
        0
      )
      if (outstanding <= 0) return
      if (lines.some((line) => line.purchaseOrderLineId === poLine.id)) return
      const isSerialTracked = poLine.item?.isSerialTracked ?? false
      rememberItem(poLine.itemId, {
        name: poLine.item?.name ?? poLine.itemId,
        sku: poLine.item?.sku,
        isSerialTracked,
        costPrice: Number(poLine.unitPrice),
        modelNumber: poLine.item?.modelNumber,
        brand: poLine.item?.brand,
        primaryCategory: poLine.item?.primaryCategory,
      })
      append({
        ...emptyLine(poLine.itemId),
        purchaseOrderLineId: poLine.id,
        quantityReceived: outstanding,
        unitCost: Number(poLine.unitPrice) > 0 ? Number(poLine.unitPrice) : undefined,
        srp: poLine.srp != null ? Number(poLine.srp) : undefined,
        discounts: poLine.discounts ?? undefined,
        isFreebie: poLine.isFreebie ?? false,
        ...(isSerialTracked && { serialNumbers: Array.from({ length: outstanding }, () => '') }),
      })
      if (isSerialTracked) openDrawer(poLine.id, 'serials')
      pulled += 1
    })
    if (pulled > 0) {
      showToast({
        title: `${pulled} outstanding ${pulled === 1 ? 'line' : 'lines'} pulled from ${linkedPo.code}`,
        status: 'success',
      })
    }
  }

  function linkPo(po: PurchaseOrderSummary): void {
    setLinkedPo(po)
    setPoPickerOpen(false)
    setValue('purchaseOrderNumber', po.code, { shouldValidate: false })
    if (po.orderDate) {
      setValue('purchaseOrderDate', po.orderDate.slice(0, 10), { shouldValidate: false })
    }
    setValue('supplierId', po.supplierId, { shouldValidate: showErrors })
    setSupplierName(po.supplier.name)
    // Only adopt the PO's destination when it is one this form can actually
    // post to — receiving is restricted to the real warehouses, and a PO
    // raised for a branch's own location is not in this list.
    if (!watched.warehouseId && po.warehouseId && warehouses.some((w) => w.id === po.warehouseId)) {
      setValue('warehouseId', po.warehouseId, { shouldValidate: showErrors })
    }
  }

  function unlinkPo(): void {
    setLinkedPo(null)
    setValue('purchaseOrderNumber', '', { shouldValidate: false })
    setValue('purchaseOrderDate', '', { shouldValidate: false })
    // The goods stay on the receipt — only what they answer to is dropped.
    lines.forEach((line, index) => {
      if (!line.purchaseOrderLineId) return
      setValue(`lines.${index}.purchaseOrderLineId`, undefined, { shouldValidate: false })
    })
  }

  function applyLineFix(index: number, fix?: IssueFix): void {
    const line = lines[index]
    if (!line) return
    if (fix === 'serials') openDrawer(lineKey(line), 'serials')
    if (fix === 'qty') setQuantity(index, Math.max(1, line.quantityReceived || 0))
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  /** Posts straight from the entry screen — there is no review step. The two
   * gates below are all that stand between this and a stock movement that can
   * only be undone with a debit memo, so neither may fail silently. */
  async function postNow(): Promise<void> {
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
    // resolver is what the post actually has to satisfy. Failing silently here
    // would look like a dead button.
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

  async function post(data: ReceiveStockFormValues): Promise<void> {
    const result = await onSubmit({
      ...data,
      lines: data.lines.map((line) => ({
        ...line,
        batchNumber: line.batchNumber?.trim() || undefined,
        notes: line.notes?.trim() || undefined,
        taxCode: line.taxCode || undefined,
        discounts: line.discounts && line.discounts.length > 0 ? line.discounts : undefined,
        serialNumbers:
          line.serialNumbers && line.serialNumbers.length > 0 ? line.serialNumbers : undefined,
      })),
    })
    if (result.success) onClose()
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const hasLines = fields.length > 0

  return (
    // absolute, not fixed: the working surface fills the content column (the
    // app shell's `main` is the positioning frame) so the nav sidebar and top
    // bar stay usable while a delivery is being received. Same shell as the
    // receive-against-PO screen.
    <div
      className={`${PLEX} absolute inset-0 z-50 flex flex-col overflow-y-auto bg-[#f2f2f3] text-[#17171c]`}
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-5 border-b border-[#e4e4e9] bg-white px-4 py-3.5 lg:px-5">
        <div className="flex min-w-0 flex-col gap-1">
          <div className={`${MONO} text-[10.5px] uppercase tracking-[.08em] text-[#a3a3b2]`}>
            Inventory › Receiving › New
          </div>
          <h2 className="text-[21px] font-semibold tracking-[-.02em]">{title}</h2>
          <p className="text-[12.5px] text-[#5b5b6b]">{subtitle}</p>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[11px] text-[#5b5b6b]">Receiving</span>
            <span
              className={`${MONO} text-[18px] font-semibold tracking-[-.02em] ${
                totals.units > 0 ? 'text-[#17171c]' : 'text-[#a3a3b2]'
              }`}
            >
              {totals.units} {totals.units === 1 ? 'unit' : 'units'} · {totals.lines}{' '}
              {totals.lines === 1 ? 'line' : 'lines'}
            </span>
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

      <div className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col gap-3.5 px-3.5 py-4 lg:px-5">
        <RrDeliveryPanel
          control={control}
          errors={errors}
          warehouses={warehouses}
          canViewCost={canViewCost}
          showErrors={showErrors}
          supplierId={watched.supplierId ?? ''}
          supplierName={supplierName}
          linkedPo={linkedPo}
          totals={totals}
          onSupplierChange={(id, name) => {
            setValue('supplierId', id, { shouldValidate: showErrors })
            setSupplierName(name)
          }}
          onBrowsePo={() => setPoPickerOpen(true)}
          onUnlinkPo={unlinkPo}
        />

        <div className={PANEL}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeef1] px-4.5 py-3.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex items-center gap-2.5">
                <span className="text-[13.5px] font-semibold">
                  Items received <span className="text-[#b42318]">*</span>
                </span>
                <span className={`${MONO} text-[11px] text-[#8b8b9b]`}>
                  {fields.length} {fields.length === 1 ? 'line' : 'lines'} · {totals.units} units
                </span>
              </div>
              <span className="text-[11.5px] text-[#8b8b9b]">
                Search by name or SKU. Scanning the same item again adds a unit.
              </span>
            </div>

            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
              <div ref={searchRef} className="min-w-[240px] max-w-[480px] flex-1">
                <ItemSearchCombobox
                  key={searchNonce}
                  value=""
                  onChange={() => {}}
                  onSelect={addFromCatalog}
                  compact
                  placeholder="Scan or search an item to add a line…"
                />
              </div>
              {/* The search is the whole interaction, but a bare box doesn't
                  read as "this is how a line gets added" — the button says so,
                  and opens the very same picker. */}
              <button
                type="button"
                onClick={openItemSearch}
                className="flex items-center gap-1 rounded-[7px] border border-[#ddd0f7] bg-[#f1ebfb] px-3 py-1.5 text-[12.5px] font-medium text-[#3f1490] hover:bg-[#e8ddfa]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Item
              </button>
              {outstandingNotPulled.length > 0 && (
                <button
                  type="button"
                  onClick={pullPoLines}
                  className="rounded-[7px] border border-[#ddd0f7] bg-[#f1ebfb] px-2.5 py-1.5 text-[12.5px] font-medium text-[#3f1490] hover:bg-[#e8ddfa]"
                >
                  Pull {outstandingNotPulled.length} outstanding{' '}
                  {outstandingNotPulled.length === 1 ? 'line' : 'lines'}
                </button>
              )}
            </div>
          </div>

          {!hasLines ? (
            <div className="flex flex-col items-center gap-2 px-[22px] py-10 text-center">
              <PackagePlus className="h-7 w-7 text-[#d3d3db]" />
              <span className="text-[13.5px] font-semibold">No items added yet.</span>
              <span className="max-w-[430px] text-[12px] leading-[1.55] text-[#5b5b6b]">
                {linkedPo
                  ? `Search above, or pull the lines ${linkedPo.code} is still waiting on.`
                  : 'Search the catalogue above, or scan a barcode straight into the field.'}
              </span>
              <button
                type="button"
                onClick={openItemSearch}
                className="mt-2 rounded-lg bg-[#5b21b6] px-[15px] py-[9px] text-[13px] font-medium text-white hover:bg-[#4a189b]"
              >
                Search items
              </button>
            </div>
          ) : (
            <>
              <div
                className={`${MONO} ${RR_LINE_GRID} hidden items-end border-b border-[#eeeef1] bg-[#fbfbfc] px-4.5 py-2.5 text-[10px] uppercase tracking-[.09em] text-[#8b8b9b] lg:grid`}
              >
                <span>Item / SKU</span>
                <span className="text-center">Qty received</span>
                <span>Serials</span>
                <span>Details</span>
                <span className="text-right">Line total</span>
                <span />
              </div>

              {fields.map((field, index) => {
                const line = lines[index]
                if (!line) return null
                const context = contextFor(index)
                const key = lineKey(line)
                return (
                  <RrLineRow
                    key={field.id}
                    control={control}
                    lineIndex={index}
                    line={line}
                    title={labelFor(index)}
                    sku={metaFor(line.itemId)?.sku}
                    isSerialTracked={context.isSerialTracked}
                    poChip={
                      context.outstanding != null && linkedPo
                        ? `${context.outstanding} outstanding on ${linkedPo.code}`
                        : undefined
                    }
                    canViewCost={canViewCost}
                    showErrors={showErrors}
                    issues={rrLineIssues(issueLines, index, context, line).filter(
                      (issue) => showErrors || issue.kind === 'warn'
                    )}
                    drawer={drawers[key] ?? null}
                    isDuplicateSerial={(unit) => isDuplicateSerial(issueLines, index, unit)}
                    onQtyChange={(raw) => setQuantity(index, raw)}
                    onOpenDrawer={(drawer) => openDrawer(key, drawer)}
                    onSerialChange={(unit, value) => setSerial(index, unit, value)}
                    onClearSerials={() =>
                      setValue(
                        `lines.${index}.serialNumbers`,
                        Array.from({ length: line.quantityReceived || 0 }, () => ''),
                        { shouldValidate: showErrors }
                      )
                    }
                    onToggleFreebie={() => toggleFreebie(index)}
                    onToggleQualityHold={() => toggleQualityHold(index)}
                    onQcReasonChange={(value) =>
                      setValue(`lines.${index}.notes`, value, { shouldValidate: false })
                    }
                    onRemove={() => remove(index)}
                    onFixIssue={(fix) => applyLineFix(index, fix)}
                  />
                )
              })}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-[#e4e4e9] bg-[#fbfbfc] px-4.5 py-3">
                <span className="text-[11.5px] text-[#8b8b9b]">
                  Held lines land in quarantine, not as sellable stock. Freebies are received at
                  zero cost.
                </span>
                <span className={`${MONO} text-[11.5px] text-[#3d3d4a]`}>
                  {totals.units} units{canViewCost && ` · ${fmtPeso(totals.invoice)} invoiced`}
                </span>
              </div>
            </>
          )}
        </div>

        <div className={`${PANEL} flex flex-col gap-2 px-4.5 py-3.5`}>
          <label className="text-[12px] font-medium text-[#3d3d4a]">
            Notes <span className="font-normal text-[#8b8b9b]">optional</span>
          </label>
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <textarea
                {...field}
                value={field.value ?? ''}
                rows={2}
                placeholder="Damage on arrival, the driver's name, anything the next person should know…"
                className="w-full resize-y rounded-lg border border-[#d3d3db] bg-white px-3 py-2.5 text-[13px] leading-[1.5] text-[#17171c] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]"
              />
            )}
          />
          {errors.notes && (
            <span className="text-[11.5px] text-[#b42318]">{errors.notes.message}</span>
          )}
        </div>
      </div>

      <ReceiveActionBar
        blockerCount={blockers.length}
        showBlockers={showErrors}
        totals={barTotals}
        deliveryReceiptNumber={watched.deliveryReceiptNumber ?? ''}
        isSubmitting={isSubmitting}
        onCancel={onClose}
        onPrimary={postNow}
        primaryLabel={submitLabel}
        submittingLabel={submittingLabel}
      />

      {poPickerOpen && (
        <PoLinkPicker
          supplierId={watched.supplierId || undefined}
          supplierName={supplierName}
          onPick={linkPo}
          onClose={() => setPoPickerOpen(false)}
        />
      )}
    </div>
  )
}

/** Re-exported for the tests and callers that reach for it. */
export { outstandingOf }
