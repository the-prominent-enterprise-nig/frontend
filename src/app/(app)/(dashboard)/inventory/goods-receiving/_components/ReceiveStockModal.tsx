'use client'

import { useState, useEffect } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import {
  ReceiveStockFormSchema,
  type ReceiveStockFormValues,
} from '@/src/schema/inventory/goods-receiving'
import type { ApiResponse } from '@/src/libs/api/client'
import type { PurchaseOrder } from '@/src/schema/procurement/types'
import { getPurchaseOrderById } from '../_actions/get-purchase-orders'

type WarehouseOption = { id: string; name: string; code: string }
type POOption = {
  id: string
  code: string
  orderDate?: string | null
  supplier?: { id: string; name: string } | null
}

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ReceiveStockFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  warehouses: WarehouseOption[]
  purchaseOrders: POOption[]
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'
const readOnlyClass =
  'w-full rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-zinc-500'
const cellInputClass =
  'w-full rounded border border-zinc-200 px-2 py-1 text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

const defaultValues: ReceiveStockFormValues = {
  code: '',
  purchaseOrderId: '',
  warehouseId: '',
  applicationType: 'new_stock',
  modeOfTransfer: '',
  nndpCost: undefined,
  receivedAt: '',
  notes: '',
  lines: [],
}

export default function ReceiveStockModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  warehouses,
  purchaseOrders,
}: Props) {
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)
  const [isLoadingPO, setIsLoadingPO] = useState(false)

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ReceiveStockFormValues>({
    resolver: zodResolver(ReceiveStockFormSchema),
    defaultValues,
  })

  const { fields, replace } = useFieldArray({ control, name: 'lines' })

  const purchaseOrderId = watch('purchaseOrderId')

  // Load PO details and populate lines when PO selection changes
  useEffect(() => {
    if (!purchaseOrderId) {
      setSelectedPO(null)
      replace([])
      return
    }

    let cancelled = false
    setIsLoadingPO(true)

    getPurchaseOrderById(purchaseOrderId).then((result) => {
      if (cancelled) return
      setIsLoadingPO(false)
      if (!result.success || !result.data) return

      const po = result.data as PurchaseOrder
      setSelectedPO(po)

      replace(
        po.lines.map((line) => ({
          purchaseOrderLineId: line.id,
          quantityReceived: Math.max(0, line.quantity - (line.receivedQuantity ?? 0)),
          unitCost: line.unitPrice,
          batchNumber: '',
          expiryDate: '',
          qualityHold: false,
          notes: '',
        }))
      )

      if (po.warehouseId) setValue('warehouseId', po.warehouseId)
    })

    return () => {
      cancelled = true
    }
  }, [purchaseOrderId, replace, setValue])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      reset(defaultValues)
      setSelectedPO(null)
    }
  }, [isOpen, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: ReceiveStockFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Receive Stock</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Record incoming stock against a purchase order.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
          <div className="space-y-5 px-6 py-5">
            {/* Reference Number + Date Received */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Reference Number <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="code"
                  control={control}
                  render={({ field }) => (
                    <input {...field} type="text" placeholder="GRN-0001" className={fieldClass} />
                  )}
                />
                {errors.code && <p className="mt-1 text-xs text-red-600">{errors.code.message}</p>}
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

            {/* Purchase Order */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Purchase Order (PO) <span className="text-red-500">*</span>
              </label>
              <Controller
                name="purchaseOrderId"
                control={control}
                render={({ field }) => (
                  <select {...field} className={`${fieldClass} bg-white`}>
                    <option value="">Select purchase order…</option>
                    {purchaseOrders.map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.code}
                        {po.supplier?.name ? ` — ${po.supplier.name}` : ''}
                        {po.orderDate ? ` (${new Date(po.orderDate).toLocaleDateString()})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.purchaseOrderId && (
                <p className="mt-1 text-xs text-red-600">{errors.purchaseOrderId.message}</p>
              )}
            </div>

            {/* Origin (Supplier) + Destination Warehouse */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Origin (Supplier)
                </label>
                <div className={readOnlyClass}>
                  {isLoadingPO ? (
                    <span className="text-zinc-400">Loading…</span>
                  ) : (
                    (selectedPO?.supplier?.name ?? '—')
                  )}
                </div>
              </div>

              <div>
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
            </div>

            {/* Application Type + Mode of Transfer */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Application Type <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="applicationType"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      <option value="new_stock">New Stock</option>
                      <option value="revert">Revert</option>
                    </select>
                  )}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Mode of Transfer
                </label>
                <Controller
                  name="modeOfTransfer"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="e.g. Road, Air, Sea"
                      className={fieldClass}
                    />
                  )}
                />
              </div>
            </div>

            {/* NNDP Cost */}
            <div className="sm:w-1/2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">NNDP Cost</label>
              <Controller
                name="nndpCost"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={field.value ?? ''}
                    className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                    }
                  />
                )}
              />
              {errors.nndpCost && (
                <p className="mt-1 text-xs text-red-600">{errors.nndpCost.message}</p>
              )}
            </div>

            {/* Lines table */}
            {isLoadingPO && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                <span className="ml-2 text-sm text-zinc-500">Loading PO lines…</span>
              </div>
            )}

            {!isLoadingPO && purchaseOrderId && fields.length === 0 && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 py-6 text-center text-sm text-zinc-400">
                No open lines found on this purchase order.
              </div>
            )}

            {!isLoadingPO && fields.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-zinc-800">Items to Receive</h3>
                <div className="overflow-x-auto rounded-lg border border-zinc-200">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2 text-center">Ordered / Received</th>
                        <th className="px-3 py-2">Qty to Receive</th>
                        <th className="px-3 py-2">Unit Cost</th>
                        <th className="px-3 py-2">Batch No.</th>
                        <th className="px-3 py-2 text-center">QC Hold</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {fields.map((field, idx) => {
                        const poLine = selectedPO?.lines[idx]
                        return (
                          <tr key={field.id} className="hover:bg-zinc-50">
                            <td className="px-3 py-2">
                              {poLine?.item ? (
                                <div>
                                  <p className="font-medium text-zinc-800">{poLine.item.sku}</p>
                                  <p className="text-xs text-zinc-500">{poLine.item.name}</p>
                                </div>
                              ) : (
                                <span className="text-zinc-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center text-zinc-600">
                              {poLine ? (
                                <span>
                                  {poLine.quantity}{' '}
                                  <span className="text-zinc-400">
                                    / {poLine.receivedQuantity ?? 0}
                                  </span>
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <Controller
                                name={`lines.${idx}.quantityReceived`}
                                control={control}
                                render={({ field: f }) => (
                                  <input
                                    {...f}
                                    type="number"
                                    min="0.01"
                                    step="any"
                                    className={`w-24 ${cellInputClass}`}
                                    onChange={(e) =>
                                      f.onChange(e.target.value === '' ? 0 : Number(e.target.value))
                                    }
                                  />
                                )}
                              />
                              {errors.lines?.[idx]?.quantityReceived && (
                                <p className="mt-0.5 text-xs text-red-600">
                                  {errors.lines[idx]?.quantityReceived?.message}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <Controller
                                name={`lines.${idx}.unitCost`}
                                control={control}
                                render={({ field: f }) => (
                                  <input
                                    {...f}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={f.value ?? ''}
                                    className={`w-28 ${cellInputClass}`}
                                    onChange={(e) =>
                                      f.onChange(
                                        e.target.value === '' ? undefined : Number(e.target.value)
                                      )
                                    }
                                  />
                                )}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Controller
                                name={`lines.${idx}.batchNumber`}
                                control={control}
                                render={({ field: f }) => (
                                  <input
                                    {...f}
                                    type="text"
                                    placeholder="Optional"
                                    className="w-28 rounded border border-zinc-200 px-2 py-1 text-sm"
                                  />
                                )}
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Controller
                                name={`lines.${idx}.qualityHold`}
                                control={control}
                                render={({ field: f }) => (
                                  <input
                                    type="checkbox"
                                    checked={f.value ?? false}
                                    onChange={(e) => f.onChange(e.target.checked)}
                                    className="h-4 w-4 rounded border-zinc-300"
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
                {errors.lines && !Array.isArray(errors.lines) && (
                  <p className="mt-1 text-xs text-red-600">{errors.lines.message}</p>
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Notes</label>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={2}
                    placeholder="Optional notes about this receipt…"
                    className={`${fieldClass} resize-none`}
                  />
                )}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || fields.length === 0}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Receiving…' : 'Receive Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
