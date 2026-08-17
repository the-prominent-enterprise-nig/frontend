'use client'

import { Fragment, useEffect, useState } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { X, Loader2, PackageCheck, ScanBarcode, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { receiveStock } from '../../goods-receiving/_actions/receive-stock'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { showToast } from '@/src/components/ui/toast'
import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'
import {
  ItemSearchCombobox,
  type ItemSearchMeta,
} from '../../purchase-requests/_components/ItemSearchCombobox'
import type { SearchComboboxOption } from '@/src/components/ui/SearchCombobox'

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
    // Optional — Scenario 05 followup (Part 5): an extra "freebie" line added
    // via "Add Freebie Item" isn't tied to any PO line (a supplier-given free
    // unit that was never on the original order), unlike every other line
    // here which always ties back to one.
    purchaseOrderLineId: z.string().optional(),
    itemId: z.string().min(1, 'Item is required'),
    quantityReceived: z.number().positive('Must be greater than 0'),
    unitCost: z.number().min(0).optional(),
    isFreebie: z.boolean().optional(),
    batchNumber: z.string().optional(),
    expiryDate: z.string().optional(),
    qualityHold: z.boolean(),
    notes: z.string().optional(),
    // Not sent to the server — carried on the line purely so the refine()
    // below can enforce "every selected serial-tracked line needs a serial
    // per unit" without reaching into component state.
    selected: z.boolean(),
    isSerialTracked: z.boolean().optional(),
    // Serial-tracked items reject receiving unless serialNumbers is set
    // (stock.service.ts) — one supplier-provided serial per unit, typed in
    // by whoever is physically receiving the delivery. Applies equally to a
    // freebie line: the backend's serial-tracking check is keyed off the
    // item, not off isFreebie.
    serialNumbers: z.array(z.string().min(1, 'Required')).optional(),
  })
  .refine(
    (line) => {
      if (!line.selected) return true
      if (line.isSerialTracked) {
        return (
          !!line.serialNumbers &&
          line.serialNumbers.length === line.quantityReceived &&
          line.serialNumbers.every((s) => s.trim().length > 0)
        )
      }
      return (
        !line.serialNumbers ||
        line.serialNumbers.length === 0 ||
        line.serialNumbers.length === line.quantityReceived
      )
    },
    {
      message: 'A serial number is required for every unit',
      path: ['serialNumbers'],
    }
  )

const ReceivePoFormSchema = z.object({
  code: z.string().optional(),
  warehouseId: z.string().min(1, 'Destination warehouse is required'),
  receivedAt: z.string().optional(),
  notes: z.string().max(1000).optional(),
  withholding: z.enum(['none', 'pct_1']).optional(),
  lines: z.array(ReceivePoLineSchema).min(1),
})

type ReceivePoFormValues = z.infer<typeof ReceivePoFormSchema>

// ─── Styles ───────────────────────────────────────────────────────────────────

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'
const cellInputClass =
  'w-full rounded border border-zinc-200 px-2 py-1.5 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

// Scenario 05 followup (Part 5) — a supplier-given free unit that was never
// on the original PO. No purchaseOrderLineId, forced isFreebie: true and
// unitCost stays unset (receiveStock() forces freebie cost to 0 server-side
// regardless, same as the standalone Receiving form). Serial-tracking is
// unknown until an item is picked via the combobox (see
// handleFreebieItemSelect), so it starts false/empty like a not-yet-tracked line.
const emptyFreebieLine = (): ReceivePoFormValues['lines'][number] => ({
  purchaseOrderLineId: undefined,
  itemId: '',
  quantityReceived: 1,
  unitCost: undefined,
  isFreebie: true,
  batchNumber: '',
  expiryDate: '',
  qualityHold: false,
  notes: '',
  selected: true,
  isSerialTracked: false,
  serialNumbers: undefined,
})

// ─── Component ────────────────────────────────────────────────────────────────

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
        batchNumber: '',
        expiryDate: '',
        qualityHold: false,
        notes: '',
        selected: defaultLineSelected(l),
        isSerialTracked: !!l.item?.isSerialTracked,
      }
    })

  const [selectedLines, setSelectedLines] = useState<boolean[]>([])
  // Names for freebie items picked via live search this session — PO lines
  // already carry their item's name off po.lines, but a freebie line's item
  // is picked fresh and has no such source, so ItemSearchCombobox's onSelect
  // populates this to resolve initialLabel.
  const [pickedItems, setPickedItems] = useState<Record<string, { name: string } & ItemSearchMeta>>(
    {}
  )
  // Every PO line is fixed/known upfront (no combobox to wait on, unlike
  // the standalone Goods Receiving form), so serial-tracked lines start
  // expanded — staff shouldn't have to hunt for a hidden control to enter
  // the supplier's serials. Keyed by line index; a freebie line is added to
  // this set once its picked item turns out to be serial-tracked (see
  // handleFreebieItemSelect).
  const [expandedSerialRows, setExpandedSerialRows] = useState<Set<number>>(new Set())

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ReceivePoFormValues>({
    resolver: zodResolver(ReceivePoFormSchema),
    defaultValues: {
      code: '',
      warehouseId: po?.warehouseId ?? '',
      receivedAt: '',
      notes: '',
      withholding: 'none',
      lines: defaultLines(),
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const watchedLines = watch('lines')

  useEffect(() => {
    if (!po) return
    setSelectedLines(po.lines.map(defaultLineSelected))
    reset({
      code: '',
      warehouseId: po.warehouseId ?? '',
      receivedAt: '',
      notes: '',
      withholding: 'none',
      lines: defaultLines(),
    })
    setExpandedSerialRows(new Set(po.lines.flatMap((l, i) => (l.item?.isSerialTracked ? [i] : []))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [po])

  if (!po) return null

  // A freebie line added via "Add Freebie Item" has no entry in
  // selectedLines (only po.lines seeded it) — defaults to selected, same
  // fallback every other selection read below relies on.
  const isLineSelected = (idx: number) => selectedLines[idx] ?? true
  const selectedCount = fields.filter((_, idx) => isLineSelected(idx)).length

  function toggleLine(idx: number) {
    const nextValue = !isLineSelected(idx)
    setSelectedLines((prev: boolean[]) => {
      const next = [...prev]
      next[idx] = nextValue
      return next
    })
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

  // One box per physical unit rather than a shared multi-serial textarea —
  // easier to scan/verify against a delivery of individually-labeled units
  // than typing/pasting a comma- or newline-separated list.
  function handleUnitSerialChange(lineIdx: number, unitIdx: number, value: string): void {
    const qty = Math.max(0, Math.floor(Number(watchedLines?.[lineIdx]?.quantityReceived) || 0))
    const current = watchedLines?.[lineIdx]?.serialNumbers ?? []
    const next = Array.from({ length: qty }, (_, i) => (i === unitIdx ? value : (current[i] ?? '')))
    setValue(`lines.${lineIdx}.serialNumbers`, next, { shouldValidate: true })
  }

  function handleFreebieItemSelect(idx: number, option: SearchComboboxOption): void {
    const meta = option.meta as ItemSearchMeta | undefined
    const isSerialTracked = meta?.isSerialTracked ?? false
    setPickedItems((prev) => ({
      ...prev,
      [option.id]: {
        name: option.primary,
        costPrice: meta?.costPrice ?? null,
        isSerialTracked,
      },
    }))
    setValue(`lines.${idx}.isSerialTracked`, isSerialTracked, { shouldValidate: true })
    if (isSerialTracked) {
      setExpandedSerialRows((prev) => new Set(prev).add(idx))
    }
  }

  async function handleFormSubmit(data: ReceivePoFormValues) {
    if (!po) return
    const result = await receiveStock({
      code: data.code || undefined,
      warehouseId: data.warehouseId,
      applicationType: 'new_stock',
      receivedAt: data.receivedAt || undefined,
      notes: data.notes || undefined,
      supplierId: po.supplier.id,
      withholding: data.withholding,
      lines: data.lines
        .filter((_, idx) => isLineSelected(idx))
        .map((l) => ({
          purchaseOrderLineId: l.purchaseOrderLineId,
          itemId: l.itemId,
          quantityReceived: l.quantityReceived,
          unitCost: l.unitCost,
          isFreebie: l.isFreebie,
          batchNumber: l.batchNumber || undefined,
          expiryDate: l.expiryDate || undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex w-full max-w-5xl max-h-[92vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
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
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Warehouse + Date */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Destination Warehouse <span className="text-red-500">*</span>
                </label>
                {po.warehouseId ? (
                  <>
                    <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                      {po.warehouse?.name ?? 'Warehouse'}
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">
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
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Date Received
                </label>
                <Controller
                  name="receivedAt"
                  control={control}
                  render={({ field }) => (
                    <input {...field} type="datetime-local" className={fieldClass} />
                  )}
                />
              </div>
            </div>

            {/* Reference + Notes */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  GRN Reference
                  <span className="ml-1 text-xs font-normal text-zinc-400">
                    (auto-generated if blank)
                  </span>
                </label>
                <Controller
                  name="code"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      value={field.value ?? ''}
                      type="text"
                      placeholder="GRN-YYYYMMDD-0001"
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
            </div>

            {/* Withholding */}
            <div className="sm:w-1/2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">Withholding</label>
              <Controller
                name="withholding"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    value={field.value ?? 'none'}
                    className={`${fieldClass} bg-white`}
                  >
                    <option value="none">None</option>
                    <option value="pct_1">1% Withholding</option>
                  </select>
                )}
              />
            </div>

            {/* Lines table */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-700">
                  Line Items
                  <span className="ml-1.5 text-xs font-normal text-zinc-400">
                    — check the lines being delivered
                  </span>
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400">
                    {selectedCount} of {fields.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => append(emptyFreebieLine())}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Freebie Item
                  </button>
                </div>
              </div>

              {fields.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 py-10 text-center">
                  <PackageCheck className="mb-2 h-8 w-8 text-zinc-300" />
                  <p className="text-sm text-zinc-400">No line items on this PO</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-zinc-200">
                  <table className="w-full text-sm">
                    <thead className="border-b border-zinc-100 bg-zinc-50">
                      <tr>
                        <th className="w-10 px-3 py-2.5" />
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 w-[200px]">
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
                        {canViewCost && (
                          <th className="px-3 py-2.5 text-center text-xs font-medium text-zinc-500 w-[90px]">
                            Unit Cost
                          </th>
                        )}
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 w-[110px]">
                          Batch No.
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 w-[120px]">
                          Expiry Date
                        </th>
                        <th className="px-3 py-2.5 text-center text-xs font-medium text-zinc-500 w-[60px]">
                          QC Hold
                        </th>
                        <th className="px-3 py-2.5 text-center text-xs font-medium text-zinc-500">
                          Serials <span className="text-red-400">*</span>
                        </th>
                        <th className="w-10 px-2 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {fields.map((field, idx) => {
                        const poLine = po.lines[idx]
                        const isExtraLine = !poLine
                        const alreadyReceived = Number(poLine?.receivedQuantity ?? 0)
                        const ordered = Number(poLine?.quantity ?? 0)
                        const remaining = Math.max(ordered - alreadyReceived, 0)

                        const isSelected = isLineSelected(idx)
                        const isSerialTracked = poLine
                          ? !!poLine?.item?.isSerialTracked
                          : !!watchedLines?.[idx]?.isSerialTracked

                        return (
                          <Fragment key={field.id}>
                            <tr
                              className={`transition-colors ${isSelected ? 'hover:bg-zinc-50/50' : 'bg-zinc-50/40 opacity-50'}`}
                            >
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
                              <td className="px-4 py-3 min-w-56">
                                {isExtraLine ? (
                                  <div>
                                    <Controller
                                      name={`lines.${idx}.itemId`}
                                      control={control}
                                      render={({ field: f }) => (
                                        <ItemSearchCombobox
                                          value={f.value}
                                          onChange={f.onChange}
                                          onSelect={(option) =>
                                            handleFreebieItemSelect(idx, option)
                                          }
                                          error={errors.lines?.[idx]?.itemId?.message}
                                          initialLabel={pickedItems[f.value]?.name}
                                        />
                                      )}
                                    />
                                    <span className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                                      Freebie
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <p className="font-medium text-zinc-800 leading-tight">
                                      {poLine?.item?.name ?? poLine?.itemId}
                                    </p>
                                    {poLine?.item?.sku && (
                                      <p className="font-mono text-xs text-zinc-400">
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
                                  </>
                                )}
                              </td>

                              {/* Ordered */}
                              <td className="px-3 py-3 text-center text-zinc-500">
                                {isExtraLine ? '—' : ordered}
                              </td>

                              {/* Already received */}
                              <td className="px-3 py-3 text-center">
                                {isExtraLine ? (
                                  <span className="text-zinc-300">—</span>
                                ) : (
                                  <span
                                    className={
                                      alreadyReceived > 0
                                        ? 'font-medium text-zinc-800'
                                        : 'text-zinc-300'
                                    }
                                  >
                                    {alreadyReceived > 0 ? alreadyReceived : '—'}
                                  </span>
                                )}
                              </td>

                              {/* Remaining */}
                              <td className="px-3 py-3 text-center">
                                {isExtraLine ? (
                                  <span className="text-zinc-300">—</span>
                                ) : (
                                  <span
                                    className={
                                      remaining === 0
                                        ? 'text-green-600 font-medium'
                                        : 'text-amber-600 font-medium'
                                    }
                                  >
                                    {remaining === 0 ? '✓' : remaining}
                                  </span>
                                )}
                              </td>

                              {/* Qty to receive */}
                              <td className="px-3 py-3">
                                <Controller
                                  name={`lines.${idx}.quantityReceived`}
                                  control={control}
                                  render={({ field: f }) => (
                                    <input
                                      value={isNaN(f.value) ? '' : f.value}
                                      onChange={(e) => f.onChange(e.target.valueAsNumber)}
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

                              {/* Unit cost */}
                              {canViewCost && (
                                <td className="px-3 py-3">
                                  {isExtraLine ? (
                                    <span className="inline-block w-full text-right text-zinc-400">
                                      Free
                                    </span>
                                  ) : (
                                    <Controller
                                      name={`lines.${idx}.unitCost`}
                                      control={control}
                                      render={({ field: f }) => (
                                        <input
                                          value={f.value == null || isNaN(f.value) ? '' : f.value}
                                          onChange={(e) =>
                                            f.onChange(e.target.valueAsNumber || undefined)
                                          }
                                          onBlur={f.onBlur}
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          className={`${cellInputClass} text-right`}
                                        />
                                      )}
                                    />
                                  )}
                                </td>
                              )}

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

                              {/* Expiry */}
                              <td className="px-3 py-3">
                                <Controller
                                  name={`lines.${idx}.expiryDate`}
                                  control={control}
                                  render={({ field: f }) => (
                                    <input
                                      {...f}
                                      value={f.value ?? ''}
                                      type="date"
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
                                      {(watchedLines?.[idx]?.serialNumbers?.filter(Boolean)
                                        .length ?? 0) > 0
                                        ? `${watchedLines?.[idx]?.serialNumbers?.filter(Boolean).length}/${watchedLines?.[idx]?.quantityReceived || 0} entered`
                                        : 'Enter serials'}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="block text-center text-xs text-zinc-300">—</span>
                                )}
                              </td>

                              {/* Remove — only a freebie line can be removed outright; a real
                                  PO line stays in the table (deselect via the checkbox instead). */}
                              <td className="px-2 py-3 text-center">
                                {isExtraLine && (
                                  <button
                                    type="button"
                                    onClick={() => remove(idx)}
                                    className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>

                            {isSerialTracked && expandedSerialRows.has(idx) && (
                              <tr className="bg-zinc-50">
                                <td colSpan={canViewCost ? 12 : 11} className="px-4 py-3">
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
                                      const value =
                                        watchedLines?.[idx]?.serialNumbers?.[unitIdx] ?? ''
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
                                            value={value}
                                            onChange={(e) =>
                                              handleUnitSerialChange(idx, unitIdx, e.target.value)
                                            }
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
    </div>
  )
}
