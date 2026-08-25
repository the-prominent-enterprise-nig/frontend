'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import type { ApiResponse } from '@/src/libs/api/client'
import {
  CreateManualReceivingReportFormSchema,
  type CreateManualReceivingReportFormValues,
} from '@/src/schema/inventory/manual-receiving-reports'
import { ADJUSTMENT_REASON_LABELS } from '@/src/schema/inventory/stock-counts'
import { AdjustmentReasonCodeSchema } from '@/src/schema/inventory/stock-counts'
import { ItemSearchCombobox } from '../../purchase-requests/_components/ItemSearchCombobox'

type WarehouseOption = { id: string; name: string; branch?: { name: string } | null }
type SupplierOption = { id: string; code: string; name: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateManualReceivingReportFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  warehouseOptions: WarehouseOption[]
  supplierOptions: SupplierOption[]
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500'

export default function CreateManualRrModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  warehouseOptions,
  supplierOptions,
}: Props) {
  const [selectedItemIsSerialTracked, setSelectedItemIsSerialTracked] = useState<boolean | null>(
    null
  )

  const form = useForm<CreateManualReceivingReportFormValues>({
    resolver: zodResolver(CreateManualReceivingReportFormSchema),
    defaultValues: {
      itemId: '',
      warehouseId: '',
      serialNumber: '',
      notes: '',
      unitCost: undefined,
      supplierId: '',
    },
  })

  if (!isOpen) return null

  async function handleSubmit(data: CreateManualReceivingReportFormValues) {
    const result = await onSubmit(data)
    if (result.success) {
      form.reset()
      setSelectedItemIsSerialTracked(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center px-4">
      <div className="flex w-full max-w-lg max-h-[90vh] flex-col rounded-t-2xl md:rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-prominent-purple-900">
              New Manual Receiving Report
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Originate a serial with no PO/transfer/count context — pending until a second person
              approves it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex-1 overflow-y-auto space-y-4 px-6 py-4"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              Item <span className="text-red-500">*</span>
            </label>
            <Controller
              name="itemId"
              control={form.control}
              render={({ field: f }) => (
                <ItemSearchCombobox
                  value={f.value}
                  onChange={f.onChange}
                  onSelect={(option) =>
                    setSelectedItemIsSerialTracked(
                      Boolean(
                        (option.meta as { isSerialTracked?: boolean } | undefined)?.isSerialTracked
                      )
                    )
                  }
                  error={form.formState.errors.itemId?.message}
                />
              )}
            />
            {selectedItemIsSerialTracked === false && (
              <p className="mt-1 text-xs text-red-600">
                This item isn&apos;t serial-tracked — a manual receiving report only originates
                serial-tracked units.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              Warehouse <span className="text-red-500">*</span>
            </label>
            <Controller
              name="warehouseId"
              control={form.control}
              render={({ field: f }) => (
                <select {...f} className={fieldClass}>
                  <option value="">Select a warehouse…</option>
                  {warehouseOptions.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.branch?.name ?? wh.name}
                    </option>
                  ))}
                </select>
              )}
            />
            {form.formState.errors.warehouseId && (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.warehouseId.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              Serial Number <span className="text-red-500">*</span>
            </label>
            <Controller
              name="serialNumber"
              control={form.control}
              render={({ field: f }) => (
                <input
                  {...f}
                  type="text"
                  placeholder="Exactly as printed on the physical unit"
                  className={fieldClass}
                />
              )}
            />
            {form.formState.errors.serialNumber && (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.serialNumber.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              Reason <span className="text-red-500">*</span>
            </label>
            <Controller
              name="reasonCode"
              control={form.control}
              render={({ field: f }) => (
                <select {...f} className={fieldClass}>
                  <option value="">Select a reason…</option>
                  {AdjustmentReasonCodeSchema.options.map((code) => (
                    <option key={code} value={code}>
                      {ADJUSTMENT_REASON_LABELS[code]}
                    </option>
                  ))}
                </select>
              )}
            />
            {form.formState.errors.reasonCode && (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.reasonCode.message}
              </p>
            )}
          </div>

          <div className="border-t border-zinc-100 pt-4">
            <p className="mb-3 text-xs font-medium text-zinc-500">
              Financial value (optional) — leave blank if unknown, or fill both to post a journal
              entry when approved
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Unit Cost</label>
                <Controller
                  name="unitCost"
                  control={form.control}
                  render={({ field: f }) => (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={f.value ?? ''}
                      onChange={(e) =>
                        f.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                      }
                      onBlur={f.onBlur}
                      className={fieldClass}
                    />
                  )}
                />
                {form.formState.errors.unitCost && (
                  <p className="mt-1 text-xs text-red-600">
                    {form.formState.errors.unitCost.message}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Supplier</label>
                <Controller
                  name="supplierId"
                  control={form.control}
                  render={({ field: f }) => (
                    <select {...f} className={fieldClass}>
                      <option value="">Select a supplier…</option>
                      {supplierOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} — {s.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {form.formState.errors.supplierId && (
                  <p className="mt-1 text-xs text-red-600">
                    {form.formState.errors.supplierId.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Notes</label>
            <Controller
              name="notes"
              control={form.control}
              render={({ field: f }) => (
                <textarea
                  {...f}
                  rows={3}
                  placeholder="Additional context for the approver…"
                  className={fieldClass}
                />
              )}
            />
          </div>
        </form>

        <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={form.handleSubmit(handleSubmit)}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 rounded-lg bg-prominent-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-700 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Submit
          </button>
        </div>
      </div>
    </div>
  )
}
