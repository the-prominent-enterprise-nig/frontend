'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, CheckCircle, GitMerge, XCircle } from 'lucide-react'
import {
  ReleaseHoldFormSchema,
  ReleaseHoldFormValues,
  BatchSummary,
} from '@/src/schema/inventory/quality-hold'
import type { ApiResponse } from '@/src/libs/api/client'
import type { WarehouseSummary } from '@/src/schema/inventory/warehouses'

type Props = {
  isOpen: boolean
  batch: BatchSummary | null
  onClose: () => void
  onSubmit: (batchId: string, data: ReleaseHoldFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  warehouseOptions: WarehouseSummary[]
}

const ACTION_CONFIG = {
  release: {
    label: 'Release All',
    description: 'All stock returned to available',
    icon: CheckCircle,
    color: 'border-green-500 bg-green-50',
    textColor: 'text-green-700',
    iconColor: 'text-green-600',
  },
  partial_release: {
    label: 'Partial Release',
    description: 'Release a portion, hold the rest',
    icon: GitMerge,
    color: 'border-blue-500 bg-blue-50',
    textColor: 'text-blue-700',
    iconColor: 'text-blue-600',
  },
  reject: {
    label: 'Reject (RTV)',
    description: 'Return to vendor, not usable',
    icon: XCircle,
    color: 'border-red-500 bg-red-50',
    textColor: 'text-red-700',
    iconColor: 'text-red-600',
  },
}

export default function ReleaseHoldModal({
  isOpen,
  batch,
  onClose,
  onSubmit,
  isSubmitting,
  warehouseOptions,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ReleaseHoldFormValues>({
    resolver: zodResolver(ReleaseHoldFormSchema),
    defaultValues: {
      action: 'release',
      reason: '',
      releasedQuantity: undefined,
      destinationWarehouseId: '',
      supplierRef: '',
    },
  })

  const action = watch('action')

  useEffect(() => {
    if (!isOpen) reset()
  }, [isOpen, reset])

  if (!isOpen || !batch) return null

  async function handleFormSubmit(data: ReleaseHoldFormValues) {
    if (!batch) return
    const result = await onSubmit(batch.id, {
      ...data,
      destinationWarehouseId: data.destinationWarehouseId || undefined,
      supplierRef: data.supplierRef || undefined,
    })
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Inspection Decision</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Batch <span className="font-mono font-medium text-zinc-800">{batch.batchNumber}</span>
              {batch.item && ` · ${batch.item.name}`}
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
          <div className="grid gap-4 px-6 py-5">
            {/* Action */}
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700">
                Inspection Outcome <span className="text-red-500">*</span>
              </label>
              <Controller
                name="action"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(ACTION_CONFIG) as (keyof typeof ACTION_CONFIG)[]).map((key) => {
                      const cfg = ACTION_CONFIG[key]
                      const Icon = cfg.icon
                      const selected = field.value === key
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => field.onChange(key)}
                          className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all ${
                            selected ? cfg.color : 'border-zinc-200 hover:border-zinc-300'
                          }`}
                        >
                          <Icon
                            className={`h-5 w-5 ${selected ? cfg.iconColor : 'text-zinc-400'}`}
                          />
                          <p
                            className={`text-xs font-semibold ${selected ? cfg.textColor : 'text-zinc-600'}`}
                          >
                            {cfg.label}
                          </p>
                          <p className="text-[10px] leading-tight text-zinc-400">
                            {cfg.description}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                )}
              />
            </div>

            {/* Partial release quantity */}
            {action === 'partial_release' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Quantity to Release <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="releasedQuantity"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="number"
                      min="1"
                      step="1"
                      placeholder="0"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                      }
                    />
                  )}
                />
                {errors.releasedQuantity && (
                  <p className="mt-1 text-xs text-red-600">{errors.releasedQuantity.message}</p>
                )}
              </div>
            )}

            {/* Destination warehouse (release / partial release) */}
            {(action === 'release' || action === 'partial_release') && (
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Destination Warehouse
                  <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
                </label>
                <Controller
                  name="destinationWarehouseId"
                  control={control}
                  render={({ field }) => (
                    <select
                      {...field}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                    >
                      <option value="">Same warehouse</option>
                      {warehouseOptions.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
              </div>
            )}

            {/* Supplier / PO ref for RTV */}
            {action === 'reject' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Supplier / PO Reference
                  <span className="ml-1 text-xs font-normal text-zinc-400">
                    (links to original PO for RTV)
                  </span>
                </label>
                <Controller
                  name="supplierRef"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="e.g. PO-2024-0042 or Supplier name"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                    />
                  )}
                />
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Reason / Inspector Notes <span className="text-red-500">*</span>
              </label>
              <Controller
                name="reason"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={3}
                    placeholder={
                      action === 'reject'
                        ? 'Document the defect or non-conformance…'
                        : 'Describe inspection findings…'
                    }
                    className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
              {errors.reason && (
                <p className="mt-1 text-xs text-red-600">{errors.reason.message}</p>
              )}
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
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
                action === 'reject'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-prominent-purple-700 hover:bg-prominent-purple-800'
              }`}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting
                ? 'Processing…'
                : action === 'release'
                  ? 'Release Stock'
                  : action === 'partial_release'
                    ? 'Partial Release'
                    : 'Reject & RTV'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
