'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import { ReorderRuleFormSchema, type ReorderRuleFormValues } from '@/src/schema/inventory/reorder'
import type { ApiResponse } from '@/src/libs/api/client'

type ItemOption = { id: string; name: string; sku: string }
type WarehouseOption = { id: string; name: string; code: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ReorderRuleFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  items: ItemOption[]
  warehouses: WarehouseOption[]
  initial?: Partial<ReorderRuleFormValues>
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

export default function ReorderRuleModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  items,
  warehouses,
  initial,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReorderRuleFormValues>({
    resolver: zodResolver(ReorderRuleFormSchema),
    defaultValues: { reorderPoint: 0, reorderQuantity: 1, autoCreatePr: false, ...initial },
  })

  useEffect(() => {
    if (!isOpen) reset({ reorderPoint: 0, reorderQuantity: 1, autoCreatePr: false })
    else if (initial) reset(initial as ReorderRuleFormValues)
  }, [isOpen, initial, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: ReorderRuleFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Reorder Rule</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Set thresholds to trigger automatic reorder requests.
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
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Item <span className="text-red-500">*</span>
              </label>
              <Controller
                name="itemId"
                control={control}
                render={({ field }) => (
                  <select {...field} className={`${fieldClass} bg-white`}>
                    <option value="">Select item…</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.sku} — {item.name}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.itemId && (
                <p className="mt-1 text-xs text-red-600">{errors.itemId.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Warehouse{' '}
                <span className="ml-1 text-xs font-normal text-zinc-400">
                  (optional — applies globally if blank)
                </span>
              </label>
              <Controller
                name="warehouseId"
                control={control}
                render={({ field }) => (
                  <select {...field} value={field.value ?? ''} className={`${fieldClass} bg-white`}>
                    <option value="">All Warehouses</option>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.code} — {wh.name}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Reorder Point <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="reorderPoint"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="50"
                      value={field.value === 0 ? '' : field.value}
                      className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? 0 : Number(e.target.value))
                      }
                    />
                  )}
                />
                {errors.reorderPoint && (
                  <p className="mt-1 text-xs text-red-600">{errors.reorderPoint.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Reorder Quantity <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="reorderQuantity"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="number"
                      min="1"
                      step="1"
                      placeholder="200"
                      className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                      }
                    />
                  )}
                />
                {errors.reorderQuantity && (
                  <p className="mt-1 text-xs text-red-600">{errors.reorderQuantity.message}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-3">
              <Controller
                name="autoCreatePr"
                control={control}
                render={({ field }) => (
                  <input
                    type="checkbox"
                    id="autoCreatePr"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-prominent-purple-700"
                  />
                )}
              />
              <label htmlFor="autoCreatePr" className="text-sm">
                <span className="font-medium text-zinc-800">Auto-create Purchase Requisition</span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  Automatically create a PR when stock drops below the reorder point.
                </span>
              </label>
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
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Saving…' : 'Save Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
