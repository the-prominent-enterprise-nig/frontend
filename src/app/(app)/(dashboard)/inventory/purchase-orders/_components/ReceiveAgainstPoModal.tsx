'use client'

import { Fragment, useEffect, useState } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { fmtMoney } from '@/src/libs/data/AccountingV2Data'
import {
  X,
  Loader2,
  PackageCheck,
  ScanBarcode,
  ChevronUp,
  Plus,
  ChevronDown,
  Pencil,
} from 'lucide-react'
import { receiveStock } from '../../goods-receiving/_actions/receive-stock'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { showToast } from '@/src/components/ui/toast'
import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'

type Props = {
  po: PurchaseOrderSummary | null
  onClose: () => void
  onSuccess: () => void
  /** Unit cost is sensitive pricing data — hidden from Branch Manager/Stock
   * Controller, restricted to Business Owner/Accountant (Scenario 05
   * followup). Server-side enforcement in receiveStock() is the real guard. */
  canViewCost: boolean
}

// ─── Form schema ──────────────────────────────────────────────────────────────

const ReceivePoLineSchema = z
  .object({
    purchaseOrderLineId: z.string(),
    itemId: z.string(),
    quantityReceived: z.number().positive('Must be greater than 0'),
    unitCost: z.number().min(0).optional(),
    // Scenario 46 — the supplier's pricing as stated, carried through from the
    // PO line. Receiving used to keep only the resulting unitCost, so the DR
    // could not show WHY a cost was what it was and an AP bill had nothing to
    // match its own discounts against.
    srp: z.number().min(0).optional(),
    discounts: z.array(z.any()).optional(),
    // Scenario 46 — per-line tax. VAT used to be collected once at the header,
    // which meant an AP bill carrying tax per line had nothing on the receipt
    // to match against line by line.
    taxCode: z.string().optional(),
    taxAmount: z.number().min(0).optional(),
    batchNumber: z.string().optional(),
    qualityHold: z.boolean(),
    notes: z.string().optional(),
    // Not sent to the server — carried on the line purely so the refine()
    // below can enforce "every selected serial-tracked line needs a serial
    // per unit" without reaching into component state.
    selected: z.boolean(),
    isSerialTracked: z.boolean().optional(),
    // Serial-tracked items reject receiving unless serialNumbers is set
    // (stock.service.ts) — one supplier-provided serial per unit, typed in
    // by whoever is physically receiving the delivery.
    // Deliberately no per-element .min() here: element rules run on every
    // line, so an empty box on an *unticked* line failed validation and
    // blocked Confirm Receipt even though that line isn't being received.
    // Requiring a serial is the selection-aware job of superRefine below.
    serialNumbers: z.array(z.string()).optional(),
  })
  .superRefine((line, ctx) => {
    if (!line.selected) return

    if (line.isSerialTracked) {
      const serials = line.serialNumbers ?? []
      if (serials.length !== line.quantityReceived) {
        ctx.addIssue({
          code: 'custom',
          message: 'A serial number is required for every unit',
          path: ['serialNumbers'],
        })
        return
      }
      // Flag the specific blank units so a partly-filled multi-unit line
      // shows which box is missing, not just the first.
      serials.forEach((serial, unitIdx) => {
        if (serial.trim().length === 0) {
          ctx.addIssue({
            code: 'custom',
            message: 'Required',
            path: ['serialNumbers', unitIdx],
          })
        }
      })
      return
    }

    if (
      line.serialNumbers &&
      line.serialNumbers.length > 0 &&
      line.serialNumbers.length !== line.quantityReceived
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'A serial number is required for every unit',
        path: ['serialNumbers'],
      })
    }
  })

const ReceivePoFormSchema = z.object({
  warehouseId: z.string().min(1, 'Destination warehouse is required'),
  receivedAt: z.string().optional(),
  notes: z.string().max(1000).optional(),
  // Document chain: PO -> DR from supplier -> Invoice (SI) from supplier ->
  // this Receiving Report. Both are the supplier's own paperwork, typed in
  // by whoever is physically receiving the delivery.
  // Scenario 46 — the DR is what's required, not the SI. The delivery receipt
  // is the paper the driver hands over WITH the goods, so it always exists at
  // receiving time; the supplier's invoice often follows days later, and the
  // client explicitly wants it editable when it arrives. This was the wrong way
  // round: the SI was mandatory and the DR optional, which blocked receiving a
  // delivery whose invoice hadn't turned up yet.
  deliveryReceiptNumber: z
    .string()
    .min(1, "Delivery receipt number is required — it's on the paper that came with the goods"),
  supplierInvoiceNumber: z.string().optional(),
  // Tax as printed on the supplier's invoice, typed off the SI rather than
  // picked from a rule — the BIR cares about the supplier's numbers, not
  // ours. Blank = let the server derive it at the flat rate.
  vatAmount: z.number().min(0).optional(),
  withheldAmount: z.number().min(0).optional(),
  lines: z.array(ReceivePoLineSchema).min(1),
})

type ReceivePoFormValues = z.infer<typeof ReceivePoFormSchema>

// ─── Styles ───────────────────────────────────────────────────────────────────

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'
const round2 = (n: number) => Math.round(n * 100) / 100
const fmtPeso = (n: number) =>
  n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 })

const cellInputClass =
  'w-full rounded border border-zinc-200 px-2 py-1.5 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

// ─── Component ────────────────────────────────────────────────────────────────

/** Scenario 46 — how the warehouse identifies a unit on a delivery:
 * BRAND · GROUP · MODEL. Falls back through whatever is present, and finally to
 * the catalogue name, so a part with no brand or model still reads as
 * something rather than going blank. */
type TitleItem = {
  name?: string
  modelNumber?: string | null
  brand?: { name: string } | null
  primaryCategory?: { name: string; parentCategory?: { name: string } | null } | null
}

function itemTitle(item?: TitleItem): string {
  // Group, not subgroup: a leaf category IS the subgroup, so its parent is the
  // group. Fall back to the category itself only when it has no parent, which
  // means it is already top-level.
  const group = item?.primaryCategory?.parentCategory?.name ?? item?.primaryCategory?.name
  const parts = [item?.brand?.name, group, item?.modelNumber].filter(Boolean)
  return parts.length ? parts.join(' ') : (item?.name ?? '')
}

/** One label/value pair in the read-only pricing view. Uses the editor's own
 * label styling so pressing Edit doesn't shift the layout underneath you. */
function ReadOnlyPricing({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <span className="text-zinc-800">{value}</span>
    </div>
  )
}

export function ReceiveAgainstPoModal({ po, onClose, onSuccess, canViewCost }: Props) {
  // Scenario 27 — goods are always received into one of the 2 real
  // warehouses now, never a branch's own local stock, so this is
  // unconditionally the standalone-only list (no branch-scoping/locking —
  // every receiver picks between the same 2 real warehouses regardless of
  // their own branch).
  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup', 'standalone'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active', standaloneOnly: true }),
    enabled: !!po,
    staleTime: 5 * 60 * 1000,
  })

  const warehouses = warehousesQuery.data?.data?.data ?? []

  const defaultLineSelected = (l: PurchaseOrderSummary['lines'][number]) => {
    const remaining = Math.max(Number(l.quantity) - Number(l.receivedQuantity ?? 0), 0)
    return remaining > 0
  }

  const defaultLines = (): ReceivePoFormValues['lines'] =>
    (po?.lines ?? []).map((l) => {
      const alreadyReceived = Number(l.receivedQuantity ?? 0)
      const remaining = Math.max(Number(l.quantity) - alreadyReceived, 0)
      return {
        purchaseOrderLineId: l.id,
        itemId: l.itemId,
        quantityReceived: remaining > 0 ? remaining : Number(l.quantity),
        unitCost: Number(l.unitPrice) > 0 ? Number(l.unitPrice) : undefined,
        // Prefilled from what was ordered; editable, because the delivery can
        // be priced differently from the PO — which is exactly the variance
        // the 3-way match exists to surface.
        srp: l.srp != null ? Number(l.srp) : undefined,
        discounts: (l.discounts as unknown[]) ?? undefined,
        taxCode: undefined,
        taxAmount: undefined,
        batchNumber: '',
        qualityHold: false,
        notes: '',
        selected: defaultLineSelected(l),
        isSerialTracked: !!l.item?.isSerialTracked,
      }
    })

  const [selectedLines, setSelectedLines] = useState<boolean[]>([])
  // Every PO line is fixed/known upfront (no combobox to wait on, unlike
  // the standalone Goods Receiving form), so serial-tracked lines start
  // expanded — staff shouldn't have to hunt for a hidden control to enter
  // the supplier's serials. Keyed by line index since this modal's line
  // count never changes (no add/remove row).
  const [expandedSerialRows, setExpandedSerialRows] = useState<Set<number>>(new Set())
  // Scenario 46 — pricing collapses by default, like serials. Expanded on every
  // line it filled the modal, so two items barely fit; the collapsed strip
  // shows the figures that matter and opens only when one needs changing.
  const [expandedPricingRows, setExpandedPricingRows] = useState<Set<number>>(new Set())
  // Scenario 46 — a whole item collapses to its own row. Each one spans three
  // stacked rows once pricing and serials are open, so a delivery of six items
  // scrolls a long way; collapsing the ones already dealt with keeps the rest
  // reachable.
  const [collapsedItems, setCollapsedItems] = useState<Set<number>>(new Set())
  const toggleItem = (idx: number) =>
    setCollapsedItems((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  // Expanded shows the agreed figures as plain text; the inputs only appear
  // once Edit is pressed. A row of open boxes invites a stray keystroke into a
  // cost that is already correct, and most receipts are confirmed exactly as
  // the PO priced them.
  const [editingPricingRows, setEditingPricingRows] = useState<Set<number>>(new Set())
  const toggleEditPricing = (idx: number) =>
    setEditingPricingRows((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })

  const togglePricing = (idx: number) =>
    setExpandedPricingRows((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ReceivePoFormValues>({
    resolver: zodResolver(ReceivePoFormSchema),
    defaultValues: {
      warehouseId: po?.warehouseId ?? '',
      receivedAt: '',
      notes: '',
      deliveryReceiptNumber: '',
      supplierInvoiceNumber: '',
      vatAmount: undefined,
      withheldAmount: undefined,
      lines: defaultLines(),
    },
  })

  const { fields } = useFieldArray({ control, name: 'lines' })
  const watchedLines = watch('lines')

  /** The collapsed pricing strip: what was agreed, in the order it applies —
   * "SRP ₱3,000 · 3% · ₱500 · Unit cost ₱2,410.00". Reads the whole chain, so
   * a second discount can't hide behind the first. */
  const pricingSummary = (idx: number): string => {
    const l = watchedLines?.[idx]
    const parts: string[] = []
    if (l?.srp) parts.push(`SRP ${fmtMoney(Number(l.srp))}`)
    const chain = (l?.discounts ?? []) as { name?: string; type?: string; value?: number }[]
    for (const d of chain) {
      if (d?.value == null || Number.isNaN(Number(d.value))) continue
      const shown = d.type === 'amount' ? fmtMoney(Number(d.value)) : `${d.value}%`
      parts.push(d.name ? `${d.name} ${shown}` : shown)
    }
    if (l?.unitCost != null) parts.push(`Unit cost ${fmtMoney(Number(l.unitCost))}`)
    if (l?.taxCode) parts.push(`${l.taxCode} ${fmtMoney(Number(l.taxAmount ?? 0))}`)
    return parts.length ? parts.join('  ·  ') : 'No pricing set'
  }

  // Scenario 46 — unit cost follows SRP through the discount chain, the same
  // rule PurchaseOrderFormFields applies to unit price. Without this the two
  // could disagree on the same line: a receipt showing "3000 less 3% less 500"
  // beside a hand-typed cost of something else is worse than no discount at
  // all, because the numbers look reconciled and aren't.
  //
  // Only recomputes when an SRP and at least one discount exist, so a line
  // priced with a flat cost and no chain keeps whatever was entered.
  useEffect(() => {
    ;(watchedLines ?? []).forEach((line, i) => {
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
  }, [JSON.stringify((watchedLines ?? []).map((l) => [l?.srp, l?.discounts]))])

  // Live preview of what the supplier's invoice should total. VAT is never
  // assumed — it's whatever was typed off the SI, zero until then — and it
  // comes out of the entered unit costs rather than on top of them, so the
  // invoice total is what was typed either way.
  const vatAmountValue = watch('vatAmount')
  const withheldAmountValue = watch('withheldAmount')
  const grossSelected = (watchedLines ?? []).reduce(
    (sum, l, idx) =>
      selectedLines[idx] === false ? sum : sum + (l?.quantityReceived ?? 0) * (l?.unitCost ?? 0),
    0
  )
  const effectiveVat = vatAmountValue ?? 0
  const netTotal = round2(grossSelected - effectiveVat)
  const invoiceTotal = grossSelected

  useEffect(() => {
    if (!po) return
    setSelectedLines(po.lines.map(defaultLineSelected))
    reset({
      warehouseId: po.warehouseId ?? '',
      receivedAt: '',
      notes: '',
      deliveryReceiptNumber: '',
      supplierInvoiceNumber: '',
      vatAmount: undefined,
      withheldAmount: undefined,
      lines: defaultLines(),
    })
    setExpandedSerialRows(new Set(po.lines.flatMap((l, i) => (l.item?.isSerialTracked ? [i] : []))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [po])

  if (!po) return null

  const selectedCount = selectedLines.filter(Boolean).length

  function toggleLine(idx: number) {
    const nextValue = !(selectedLines[idx] ?? true)
    setSelectedLines((prev: boolean[]) =>
      prev.map((v: boolean, i: number) => (i === idx ? nextValue : v))
    )
    setValue(`lines.${idx}.selected`, nextValue, { shouldValidate: true })
  }

  function toggleSerialEntry(idx: number): void {
    setExpandedSerialRows((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) {
        next.delete(idx)
      } else {
        next.add(idx)
      }
      return next
    })
  }

  async function handleFormSubmit(data: ReceivePoFormValues) {
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
      // so the amount below is carved out of them rather than added on top.
      // Always explicit — including 0 — so the server never falls back to
      // deriving VAT nobody entered.
      vatTreatment: 'inclusive' as const,
      vatAmount: data.vatAmount ?? 0,
      withheldAmount: data.withheldAmount,
      lines: data.lines
        .filter((_, idx) => selectedLines[idx])
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

    if (result.success) {
      showToast({ title: 'Stock received', description: result.message, status: 'success' })
      onSuccess()
    } else {
      showToast({ title: 'Failed to receive stock', description: result.message, status: 'error' })
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between border-b border-zinc-200 px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Receive Stock Against PO</h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            <span className="font-mono font-medium text-prominent-purple-700">{po.code}</span>
            {' · '}
            {po.supplier.name}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        noValidate
        className="flex flex-col overflow-hidden"
      >
        {/* Body */}
        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {/* Scenario 46 — one three-track grid for the whole header rather
              than three separate grids stacked. Separate grids each solved
              their own row, so nothing lined up vertically between them; with a
              single grid every field edge runs straight down the form. Row 1
              gives the warehouse two tracks because its value is a long name. */}
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Destination Warehouse <span className="text-red-500">*</span>
              </label>
              {po.warehouseId ? (
                <>
                  <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                    {po.warehouse?.name ?? 'Warehouse'}
                  </div>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    Set when this PO was created — stock always lands where it was ordered for.
                  </p>
                </>
              ) : (
                <>
                  {/* Fallback for a PO created before the destination warehouse
                        became required at PO-creation time — still restricted to
                        the 2 real warehouses, just editable here instead of locked. */}
                  <Controller
                    name="warehouseId"
                    control={control}
                    render={({ field }) => (
                      <select {...field} className={`${fieldClass} bg-white`}>
                        <option value="">Select warehouse…</option>
                        {warehouses.map((wh) => (
                          <option key={wh.id} value={wh.id}>
                            {wh.name}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                  {errors.warehouseId && (
                    <p className="mt-1 text-xs text-red-600">{errors.warehouseId.message}</p>
                  )}
                </>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Date Received</label>
              <Controller
                name="receivedAt"
                control={control}
                render={({ field }) => (
                  <input {...field} type="datetime-local" className={fieldClass} />
                )}
              />
            </div>

            {/* Supplier's own paperwork — PO -> DR -> Invoice (SI) -> this
                Receiving Report. The Receiving Report Reference input is gone:
                stock.service.ts generates the code whenever one isn't supplied,
                and nobody was overriding it. */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Delivery Receipt No.
                <span className="text-red-500"> *</span>
                <span className="ml-1 text-xs font-normal text-zinc-400">supplier's DR</span>
              </label>
              <Controller
                name="deliveryReceiptNumber"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    value={field.value ?? ''}
                    type="text"
                    placeholder="e.g. DR-00123"
                    className={fieldClass}
                  />
                )}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Supplier Invoice No.
                {/* Kept to one line: this label sits in a three-track row, and
                    a wrapping hint pushed its input a line below the DR and
                    Notes fields beside it. The full explanation moved to the
                    tooltip. */}
                <span
                  title="The supplier's invoice often arrives days after the goods — leave this blank and fill it in later."
                  className="ml-1 text-xs font-normal text-zinc-400"
                >
                  supplier&rsquo;s SI — optional
                </span>
              </label>
              <Controller
                name="supplierInvoiceNumber"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    value={field.value ?? ''}
                    type="text"
                    placeholder="e.g. SI-00456"
                    className={fieldClass}
                  />
                )}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Notes</label>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="Delivery notes…"
                    className={fieldClass}
                  />
                )}
              />
            </div>

            {/* Tax off the supplier's invoice. Two different taxes moving in
                opposite directions: VAT is charged BY the supplier and grows
                what the invoice totals; withholding is held back FROM them and
                remitted to the BIR, shrinking only what's paid out. */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Input VAT amount
                <span className="ml-1 text-xs font-normal text-zinc-400">₱, from the SI</span>
              </label>
              <Controller
                name="vatAmount"
                control={control}
                render={({ field }) => (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                      ₱
                    </span>
                    <input
                      value={field.value == null || isNaN(field.value) ? '' : field.value}
                      onChange={(e) =>
                        field.onChange(
                          isNaN(e.target.valueAsNumber) ? undefined : e.target.valueAsNumber
                        )
                      }
                      onBlur={field.onBlur}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className={`${fieldClass} pl-7 text-right`}
                    />
                  </div>
                )}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Withholding tax amount
                <span className="ml-1 text-xs font-normal text-zinc-400">₱, BIR 2307</span>
              </label>
              <Controller
                name="withheldAmount"
                control={control}
                render={({ field }) => (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                      ₱
                    </span>
                    <input
                      value={field.value == null || isNaN(field.value) ? '' : field.value}
                      onChange={(e) =>
                        field.onChange(
                          isNaN(e.target.valueAsNumber) ? undefined : e.target.valueAsNumber
                        )
                      }
                      onBlur={field.onBlur}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className={`${fieldClass} pl-7 text-right`}
                    />
                  </div>
                )}
              />
            </div>
          </div>

          {/* What the two numbers above actually add up to, so it can be
              ticked against the supplier's invoice before confirming. */}
          {canViewCost && grossSelected > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
              <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Stock value</dt>
                  <dd className="font-medium tabular-nums text-zinc-800">{fmtPeso(netTotal)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Input VAT</dt>
                  <dd className="font-medium tabular-nums text-zinc-800">
                    {fmtPeso(effectiveVat)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-zinc-200 pt-1">
                  <dt className="font-medium text-zinc-700">Invoice total</dt>
                  <dd className="font-semibold tabular-nums text-zinc-900">
                    {fmtPeso(invoiceTotal)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-zinc-200 pt-1">
                  <dt className="font-medium text-zinc-700">
                    Payable to supplier
                    {withheldAmountValue ? ' (net of withholding)' : ''}
                  </dt>
                  <dd className="font-semibold tabular-nums text-zinc-900">
                    {fmtPeso(invoiceTotal - (withheldAmountValue ?? 0))}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Lines table — set well clear of the totals box above it. The
              header fields and the goods being received are two different
              jobs, and running them together made the totals read like part
              of the table. */}
          <div className="pt-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-700">
                Line Items
                <span className="ml-1.5 text-xs font-normal text-zinc-400">
                  — check the lines being delivered
                </span>
              </p>
              <span className="text-xs text-zinc-400">
                {selectedCount} of {fields.length} selected
              </span>
            </div>

            {fields.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 py-10 text-center">
                <PackageCheck className="mb-2 h-8 w-8 text-zinc-300" />
                <p className="text-sm text-zinc-400">No line items on this PO</p>
              </div>
            ) : (
              /* Boxless — the modal already frames this, so an inner border
                 just eats width the wide line table needs. */
              <div>
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-100 bg-zinc-50">
                    <tr>
                      <th className="w-10 px-3 py-2.5" />
                      <th className="w-[260px] px-4 py-2.5 text-left text-xs font-medium text-zinc-500">
                        Item
                      </th>
                      <th className="px-3 py-2.5 text-center text-xs font-medium text-zinc-500">
                        Ordered
                      </th>
                      <th className="px-3 py-2.5 text-center text-xs font-medium text-zinc-500">
                        Received to Date
                      </th>
                      <th className="px-3 py-2.5 text-center text-xs font-medium text-zinc-500">
                        Remaining
                      </th>
                      <th className="px-3 py-2.5 text-center text-xs font-medium text-zinc-500 w-[90px]">
                        Qty to Receive <span className="text-red-400">*</span>
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 w-[110px]">
                        Batch No.
                      </th>
                      <th className="px-3 py-2.5 text-center text-xs font-medium text-zinc-500 w-[60px]">
                        QC Hold
                      </th>
                      <th className="px-3 py-2.5 text-center text-xs font-medium text-zinc-500">
                        Serials <span className="text-red-400">*</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {fields.map((field, idx) => {
                      const poLine = po.lines[idx]
                      const alreadyReceived = Number(poLine?.receivedQuantity ?? 0)
                      const ordered = Number(poLine?.quantity ?? 0)
                      const remaining = Math.max(ordered - alreadyReceived, 0)

                      const isSelected = selectedLines[idx] ?? true
                      const isSerialTracked = !!poLine?.item?.isSerialTracked

                      return (
                        <Fragment key={field.id}>
                          {/* Whitespace, not a rule, opens every item after the
                              first. Each item spans up to three stacked rows,
                              so they need to read as separate blocks — but a
                              divider plus the old grey banding made every one
                              look boxed. A gap does the same job silently. */}
                          {idx > 0 && (
                            <tr aria-hidden="true">
                              <td colSpan={9} className="h-6" />
                            </tr>
                          )}
                          <tr className={`transition-colors ${isSelected ? '' : 'opacity-50'}`}>
                            {/* Select checkbox */}
                            <td className="px-3 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleLine(idx)}
                                className="h-4 w-4 rounded border-zinc-300 text-prominent-purple-700 focus:ring-prominent-purple-500 cursor-pointer"
                              />
                            </td>

                            {/* Item */}
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => toggleItem(idx)}
                                aria-expanded={!collapsedItems.has(idx)}
                                className="flex items-start gap-1.5 text-left"
                              >
                                {collapsedItems.has(idx) ? (
                                  <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                                ) : (
                                  <ChevronUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                                )}
                                <span className="text-[12px] font-medium leading-snug text-zinc-800">
                                  {itemTitle(poLine?.item) || poLine?.itemId}
                                </span>
                              </button>
                              {poLine?.item?.sku && (
                                <p className="font-mono text-[11px] text-zinc-400">
                                  {poLine.item.sku}
                                </p>
                              )}
                              {isSerialTracked && (
                                <span
                                  title="Each unit needs its own supplier-provided serial number — enter them in the Serials column."
                                  className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                                >
                                  Serial-tracked
                                </span>
                              )}
                            </td>

                            {/* Ordered */}
                            <td className="px-3 py-3 text-center text-zinc-500">{ordered}</td>

                            {/* Already received */}
                            <td className="px-3 py-3 text-center">
                              <span
                                className={
                                  alreadyReceived > 0
                                    ? 'font-medium text-zinc-800'
                                    : 'text-zinc-300'
                                }
                              >
                                {alreadyReceived > 0 ? alreadyReceived : '—'}
                              </span>
                            </td>

                            {/* Remaining */}
                            <td className="px-3 py-3 text-center">
                              <span
                                className={
                                  remaining === 0
                                    ? 'text-green-600 font-medium'
                                    : 'text-amber-600 font-medium'
                                }
                              >
                                {remaining === 0 ? '✓' : remaining}
                              </span>
                            </td>

                            {/* Qty to receive */}
                            <td className="px-3 py-3">
                              <Controller
                                name={`lines.${idx}.quantityReceived`}
                                control={control}
                                render={({ field: f }) => (
                                  <input
                                    value={isNaN(f.value) ? '' : f.value}
                                    onChange={(e) => {
                                      const next = e.target.valueAsNumber
                                      f.onChange(next)
                                      // Serial boxes below are rendered per-unit and registered
                                      // individually — react-hook-form doesn't clear a hidden
                                      // index's value when the array shrinks, so a lowered qty
                                      // (partial receipt) left stale empty slots that silently
                                      // failed the serials-length refine and blocked submit.
                                      const nextCount = Number.isFinite(next)
                                        ? Math.max(0, Math.floor(next))
                                        : 0
                                      setValue(
                                        `lines.${idx}.serialNumbers`,
                                        (watchedLines?.[idx]?.serialNumbers ?? []).slice(
                                          0,
                                          nextCount
                                        ),
                                        { shouldValidate: true }
                                      )
                                    }}
                                    onBlur={f.onBlur}
                                    type="number"
                                    min="0"
                                    step="1"
                                    className={`${cellInputClass} text-center ${
                                      errors.lines?.[idx]?.quantityReceived
                                        ? 'border-red-400 ring-1 ring-red-400'
                                        : ''
                                    }`}
                                  />
                                )}
                              />
                            </td>

                            {/* Scenario 46 — SRP, the discount chain, unit
                                cost and tax moved out of this row into a
                                pricing block underneath it. Four extra columns
                                squeezed into a 12-column table left every input
                                too narrow to read; the block mirrors the PO
                                form's own line card, which already presents the
                                same fields with room to breathe. */}

                            {/* Batch */}
                            <td className="px-3 py-3">
                              <Controller
                                name={`lines.${idx}.batchNumber`}
                                control={control}
                                render={({ field: f }) => (
                                  <input
                                    {...f}
                                    value={f.value ?? ''}
                                    type="text"
                                    placeholder="Optional"
                                    className={cellInputClass}
                                  />
                                )}
                              />
                            </td>

                            {/* QC Hold */}
                            <td className="px-3 py-3 text-center">
                              <Controller
                                name={`lines.${idx}.qualityHold`}
                                control={control}
                                render={({ field: f }) => (
                                  <input
                                    type="checkbox"
                                    checked={f.value}
                                    onChange={f.onChange}
                                    className="h-4 w-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
                                  />
                                )}
                              />
                            </td>

                            {/* Serials */}
                            <td className="px-3 py-3">
                              {isSerialTracked ? (
                                <div className="flex justify-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleSerialEntry(idx)}
                                    className="flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-prominent-purple-700 hover:underline"
                                  >
                                    {expandedSerialRows.has(idx) ? (
                                      <ChevronUp className="h-3 w-3" />
                                    ) : (
                                      <ScanBarcode className="h-3 w-3" />
                                    )}
                                    {(watchedLines?.[idx]?.serialNumbers?.filter(Boolean).length ??
                                      0) > 0
                                      ? `${watchedLines?.[idx]?.serialNumbers?.filter(Boolean).length}/${watchedLines?.[idx]?.quantityReceived || 0} entered`
                                      : 'Enter serials'}
                                  </button>
                                </div>
                              ) : (
                                <span className="block text-center text-xs text-zinc-300">—</span>
                              )}
                            </td>
                          </tr>

                          {/* Pricing block — the PO form's own line-card
                              layout: SRP, the discount chain applied off it,
                              the unit cost it produces, and the line's tax.
                              Sits under its row rather than inside it so each
                              input has room, and so the chain can hold more
                              than one discount. */}
                          {canViewCost && !collapsedItems.has(idx) && (
                            <tr>
                              <td />
                              <td colSpan={8} className="px-4 pb-2 pt-0">
                                <button
                                  type="button"
                                  onClick={() => togglePricing(idx)}
                                  aria-expanded={expandedPricingRows.has(idx)}
                                  className="flex w-full items-center gap-2 border-t border-zinc-200 pt-2 text-left"
                                >
                                  {expandedPricingRows.has(idx) ? (
                                    <ChevronUp className="h-3 w-3 shrink-0 text-prominent-purple-700" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3 shrink-0 text-prominent-purple-700" />
                                  )}
                                  <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                    Pricing
                                  </span>
                                  {!expandedPricingRows.has(idx) && (
                                    <span className="truncate text-[12px] text-zinc-600">
                                      {pricingSummary(idx)}
                                    </span>
                                  )}
                                  <span className="ml-auto shrink-0 text-[12px] text-zinc-500">
                                    Line total{' '}
                                    <span className="font-semibold text-zinc-800">
                                      {fmtMoney(
                                        (watchedLines?.[idx]?.quantityReceived ?? 0) *
                                          (watchedLines?.[idx]?.unitCost ?? 0)
                                      )}
                                    </span>
                                  </span>
                                </button>
                              </td>
                            </tr>
                          )}

                          {canViewCost &&
                            !collapsedItems.has(idx) &&
                            expandedPricingRows.has(idx) &&
                            !editingPricingRows.has(idx) && (
                              <tr>
                                <td />
                                <td colSpan={8} className="px-4 pb-3 pt-0">
                                  <div className="flex flex-wrap items-center gap-x-8 gap-y-2 pt-1 text-[12px]">
                                    <ReadOnlyPricing
                                      label="SRP"
                                      value={
                                        watchedLines?.[idx]?.srp
                                          ? fmtMoney(Number(watchedLines[idx].srp))
                                          : '—'
                                      }
                                    />
                                    <ReadOnlyPricing
                                      label="Discounts (off SRP)"
                                      value={
                                        (
                                          (watchedLines?.[idx]?.discounts ?? []) as {
                                            name?: string
                                            type?: string
                                            value?: number
                                          }[]
                                        )
                                          .filter((d) => d?.value != null)
                                          .map(
                                            (d) =>
                                              `${d.name ? `${d.name} ` : ''}${
                                                d.type === 'amount'
                                                  ? fmtMoney(Number(d.value))
                                                  : `${d.value}%`
                                              }`
                                          )
                                          .join('  ·  ') || '—'
                                      }
                                    />
                                    <ReadOnlyPricing
                                      label="Unit Cost"
                                      value={
                                        watchedLines?.[idx]?.unitCost != null
                                          ? fmtMoney(Number(watchedLines[idx].unitCost))
                                          : '—'
                                      }
                                    />
                                    <ReadOnlyPricing
                                      label="Tax"
                                      value={
                                        watchedLines?.[idx]?.taxCode
                                          ? `${watchedLines[idx].taxCode} ${fmtMoney(
                                              Number(watchedLines[idx].taxAmount ?? 0)
                                            )}`
                                          : '—'
                                      }
                                    />
                                    <button
                                      type="button"
                                      onClick={() => toggleEditPricing(idx)}
                                      className="ml-auto flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[12px] font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                                    >
                                      <Pencil className="h-3 w-3" /> Edit
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}

                          {canViewCost &&
                            !collapsedItems.has(idx) &&
                            expandedPricingRows.has(idx) &&
                            editingPricingRows.has(idx) && (
                              <tr>
                                <td />
                                <td colSpan={8} className="px-4 pb-3 pt-0">
                                  <div className="flex flex-wrap items-start gap-x-6 gap-y-3 pt-1">
                                    <label className="flex flex-col gap-1">
                                      <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                        SRP
                                      </span>
                                      <Controller
                                        name={`lines.${idx}.srp`}
                                        control={control}
                                        render={({ field: f }) => (
                                          <input
                                            value={f.value == null || isNaN(f.value) ? '' : f.value}
                                            onChange={(e) => {
                                              const next = e.target.valueAsNumber
                                              f.onChange(Number.isNaN(next) ? undefined : next)
                                            }}
                                            onBlur={f.onBlur}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            className="w-28 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                                          />
                                        )}
                                      />
                                    </label>

                                    <Controller
                                      name={`lines.${idx}.discounts`}
                                      control={control}
                                      render={({ field: f }) => {
                                        const chain = (
                                          (f.value ?? []) as {
                                            name?: string
                                            type: 'percentage' | 'amount'
                                            value: number
                                          }[]
                                        ).slice()
                                        const setChain = (next: typeof chain) =>
                                          f.onChange(next.length ? next : undefined)
                                        return (
                                          <div className="flex flex-col gap-1">
                                            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                              Discounts{' '}
                                              <span className="normal-case tracking-normal">
                                                (off SRP)
                                              </span>
                                            </span>
                                            {chain.map((d, di) => (
                                              <div key={di} className="flex items-center gap-1">
                                                <input
                                                  type="text"
                                                  placeholder="Discount name"
                                                  maxLength={100}
                                                  aria-label="Discount name"
                                                  value={d.name ?? ''}
                                                  onChange={(e) => {
                                                    const next = chain.slice()
                                                    next[di] = { ...d, name: e.target.value }
                                                    setChain(next)
                                                  }}
                                                  className="w-40 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                                                />
                                                <select
                                                  aria-label="Discount type"
                                                  value={d.type}
                                                  onChange={(e) => {
                                                    const next = chain.slice()
                                                    next[di] = {
                                                      ...d,
                                                      type: e.target.value as
                                                        | 'percentage'
                                                        | 'amount',
                                                    }
                                                    setChain(next)
                                                  }}
                                                  className="w-16 rounded-lg border border-zinc-200 px-1 py-1.5 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                                                >
                                                  <option value="percentage">%</option>
                                                  <option value="amount">₱</option>
                                                </select>
                                                <input
                                                  type="number"
                                                  min={0}
                                                  step={0.01}
                                                  aria-label="Discount value"
                                                  placeholder={
                                                    d.type === 'amount' ? 'Amount' : 'Percent'
                                                  }
                                                  value={Number.isFinite(d.value) ? d.value : ''}
                                                  onChange={(e) => {
                                                    const v = e.target.valueAsNumber
                                                    const next = chain.slice()
                                                    next[di] = {
                                                      ...d,
                                                      value: Number.isNaN(v) ? 0 : v,
                                                    }
                                                    setChain(next)
                                                  }}
                                                  className="w-24 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                                                />
                                                <button
                                                  type="button"
                                                  aria-label="Remove discount"
                                                  onClick={() =>
                                                    setChain(chain.filter((_, n) => n !== di))
                                                  }
                                                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-200 hover:text-red-600"
                                                >
                                                  <X className="h-3.5 w-3.5" />
                                                </button>
                                              </div>
                                            ))}
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setChain([
                                                  ...chain,
                                                  { name: undefined, type: 'percentage', value: 0 },
                                                ])
                                              }
                                              className="flex items-center gap-1 text-sm font-medium text-prominent-purple-700 hover:underline"
                                            >
                                              <Plus className="h-3 w-3" /> Add
                                            </button>
                                          </div>
                                        )
                                      }}
                                    />

                                    <label className="flex flex-col gap-1">
                                      <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                        Unit Cost
                                      </span>
                                      <Controller
                                        name={`lines.${idx}.unitCost`}
                                        control={control}
                                        render={({ field: f }) => (
                                          <input
                                            value={f.value == null || isNaN(f.value) ? '' : f.value}
                                            onChange={(e) => {
                                              const next = e.target.valueAsNumber
                                              f.onChange(Number.isNaN(next) ? undefined : next)
                                            }}
                                            onBlur={f.onBlur}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-28 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                                          />
                                        )}
                                      />
                                      <span className="text-[11px] text-zinc-400">
                                        auto from SRP &minus; discounts
                                      </span>
                                    </label>

                                    <label className="flex flex-col gap-1">
                                      <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                        Tax
                                      </span>
                                      <div className="flex items-center gap-1">
                                        <Controller
                                          name={`lines.${idx}.taxCode`}
                                          control={control}
                                          render={({ field: f }) => (
                                            <select
                                              {...f}
                                              value={f.value ?? ''}
                                              aria-label="Tax code"
                                              className="rounded-lg border border-zinc-200 px-1 py-1.5 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                                            >
                                              <option value="">—</option>
                                              <option value="VAT">VAT</option>
                                              <option value="NON_VAT">Non-VAT</option>
                                              <option value="EXEMPT">Exempt</option>
                                            </select>
                                          )}
                                        />
                                        <Controller
                                          name={`lines.${idx}.taxAmount`}
                                          control={control}
                                          render={({ field: f }) => (
                                            <input
                                              value={
                                                f.value == null || isNaN(f.value) ? '' : f.value
                                              }
                                              onChange={(e) => {
                                                const next = e.target.valueAsNumber
                                                f.onChange(Number.isNaN(next) ? undefined : next)
                                              }}
                                              onBlur={f.onBlur}
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              placeholder="0.00"
                                              aria-label="Tax amount"
                                              className="w-24 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                                            />
                                          )}
                                        />
                                      </div>
                                    </label>

                                    <button
                                      type="button"
                                      onClick={() => toggleEditPricing(idx)}
                                      className="ml-auto self-end rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[12px] font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                                    >
                                      Done
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}

                          {isSerialTracked &&
                            !collapsedItems.has(idx) &&
                            expandedSerialRows.has(idx) && (
                              <tr>
                                {/* Ruled off from the pricing block above it, the
                                  same way pricing is ruled off from the row —
                                  otherwise the two sub-sections run together
                                  into one grey slab. */}
                                <td colSpan={9} className="border-t border-zinc-200 px-4 py-3">
                                  <p className="mb-2 text-xs font-medium text-zinc-600">
                                    Enter the serial number for each unit —{' '}
                                    {Math.max(
                                      0,
                                      Math.floor(Number(watchedLines?.[idx]?.quantityReceived) || 0)
                                    )}{' '}
                                    unit(s) to receive
                                  </p>
                                  <div className="space-y-2">
                                    {Array.from({
                                      length: Math.max(
                                        0,
                                        Math.floor(
                                          Number(watchedLines?.[idx]?.quantityReceived) || 0
                                        )
                                      ),
                                    }).map((_, unitIdx) => {
                                      const unitError =
                                        errors.lines?.[idx]?.serialNumbers?.[unitIdx]?.message ??
                                        (unitIdx === 0
                                          ? errors.lines?.[idx]?.serialNumbers?.message
                                          : undefined)
                                      return (
                                        <div key={unitIdx} className="flex items-center gap-2">
                                          <span className="w-16 shrink-0 text-xs text-zinc-500">
                                            Unit {unitIdx + 1} of{' '}
                                            {Math.max(
                                              0,
                                              Math.floor(
                                                Number(watchedLines?.[idx]?.quantityReceived) || 0
                                              )
                                            )}
                                          </span>
                                          <input
                                            {...register(
                                              `lines.${idx}.serialNumbers.${unitIdx}` as `lines.${number}.serialNumbers.${number}`
                                            )}
                                            type="text"
                                            placeholder={`SN-00${unitIdx + 1}`}
                                            className={`${cellInputClass} font-mono text-xs ${
                                              unitError ? 'border-red-400 ring-1 ring-red-400' : ''
                                            }`}
                                          />
                                        </div>
                                      )
                                    })}
                                  </div>
                                  {errors.lines?.[idx]?.serialNumbers?.message && (
                                    <p className="mt-1 text-xs text-red-600">
                                      {errors.lines[idx]?.serialNumbers?.message}
                                    </p>
                                  )}
                                </td>
                              </tr>
                            )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || selectedCount === 0}
            className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-5 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60 transition-colors"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm Receipt
          </button>
        </div>
      </form>
    </div>
  )
}
