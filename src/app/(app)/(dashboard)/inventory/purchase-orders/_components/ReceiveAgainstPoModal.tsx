'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { X, Loader2, PackageCheck } from 'lucide-react'
import { receiveStock } from '../../goods-receiving/_actions/receive-stock'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { showToast } from '@/src/components/ui/toast'
import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'

type Props = {
  po: PurchaseOrderSummary | null
  onClose: () => void
  onSuccess: () => void
}

// ─── Form schema ──────────────────────────────────────────────────────────────

const ReceivePoLineSchema = z.object({
  purchaseOrderLineId: z.string(),
  itemId: z.string(),
  quantityReceived: z.number().positive('Must be greater than 0'),
  unitCost: z.number().min(0).optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  qualityHold: z.boolean(),
  notes: z.string().optional(),
})

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

// ─── Component ────────────────────────────────────────────────────────────────

export function ReceiveAgainstPoModal({ po, onClose, onSuccess }: Props) {
  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active' }),
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
      }
    })

  const [selectedLines, setSelectedLines] = useState<boolean[]>([])

  const {
    control,
    handleSubmit,
    reset,
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

  const { fields } = useFieldArray({ control, name: 'lines' })

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [po])

  if (!po) return null

  const selectedCount = selectedLines.filter(Boolean).length

  function toggleLine(idx: number) {
    setSelectedLines((prev: boolean[]) => prev.map((v: boolean, i: number) => (i === idx ? !v : v)))
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
        .filter((_, idx) => selectedLines[idx])
        .map((l) => ({
          purchaseOrderLineId: l.purchaseOrderLineId,
          itemId: l.itemId,
          quantityReceived: l.quantityReceived,
          unitCost: l.unitCost,
          batchNumber: l.batchNumber || undefined,
          expiryDate: l.expiryDate || undefined,
          qualityHold: l.qualityHold,
          notes: l.notes || undefined,
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
                <Controller
                  name="warehouseId"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      <option value="">Select warehouse…</option>
                      {warehouses.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.code} — {wh.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.warehouseId && (
                  <p className="mt-1 text-xs text-red-600">{errors.warehouseId.message}</p>
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
                        <th className="px-3 py-2.5 text-center text-xs font-medium text-zinc-500 w-[90px]">
                          Unit Cost
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 w-[110px]">
                          Batch No.
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 w-[120px]">
                          Expiry Date
                        </th>
                        <th className="px-3 py-2.5 text-center text-xs font-medium text-zinc-500 w-[60px]">
                          QC Hold
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

                        return (
                          <tr
                            key={field.id}
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
                            <td className="px-4 py-3">
                              <p className="font-medium text-zinc-800 leading-tight">
                                {poLine?.item?.name ?? poLine?.itemId}
                              </p>
                              {poLine?.item?.sku && (
                                <p className="font-mono text-xs text-zinc-400">{poLine.item.sku}</p>
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
                            <td className="px-3 py-3">
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
                            </td>

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
                          </tr>
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
