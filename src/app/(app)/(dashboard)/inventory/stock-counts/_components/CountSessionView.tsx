'use client'

import { useState, useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, Plus, AlertTriangle } from 'lucide-react'
import type {
  CountSummary,
  SubmitCountFormValues,
  CreateAdjustmentFormValues,
  CountLine,
  AddCountLineFormValues,
} from '@/src/schema/inventory/stock-counts'
import {
  ADJUSTMENT_REASON_LABELS,
  AdjustmentReasonCodeSchema,
  CreateAdjustmentFormSchema,
} from '@/src/schema/inventory/stock-counts'
import type { ApiResponse } from '@/src/libs/api/client'
import type { ItemSummary } from '@/src/schema/inventory/items'

type Props = {
  count: CountSummary | null
  onClose: () => void
  onStart: (id: string) => Promise<ApiResponse<unknown>>
  onSubmit: (args: { id: string; data: SubmitCountFormValues }) => Promise<ApiResponse<unknown>>
  onCancel: (id: string) => Promise<ApiResponse<unknown>>
  onAdjust: (data: CreateAdjustmentFormValues) => Promise<ApiResponse<unknown>>
  isStarting: boolean
  isSubmitting: boolean
  isCancelling: boolean
  isAdjusting: boolean
  items: ItemSummary[]
  canAdjust: boolean
  lines: CountLine[]
  isLoadingLines: boolean
  onAddLine: (args: { id: string; data: AddCountLineFormValues }) => Promise<ApiResponse<unknown>>
  isAddingLine: boolean
}

const reasonCodes = AdjustmentReasonCodeSchema.options

export default function CountSessionView({
  count,
  onClose,
  onStart,
  onSubmit,
  onCancel,
  onAdjust,
  isStarting,
  isSubmitting,
  isCancelling,
  isAdjusting,
  items,
  canAdjust,
  lines,
  isLoadingLines,
  onAddLine,
  isAddingLine,
}: Props) {
  const [tab, setTab] = useState<'count' | 'adjust'>('count')
  const [countedQtyById, setCountedQtyById] = useState<Record<string, string>>({})
  const [addItemId, setAddItemId] = useState('')

  const adjustForm = useForm<CreateAdjustmentFormValues>({
    resolver: zodResolver(CreateAdjustmentFormSchema),
    defaultValues: {
      warehouseId: count?.warehouse?.id ?? '',
      adjustmentDate: new Date().toISOString().slice(0, 10),
      reasonCode: 'miscounted',
      notes: '',
      lines: [],
    },
  })
  const adjustLines = useFieldArray({ control: adjustForm.control, name: 'lines' })

  useEffect(() => {
    if (count?.warehouse?.id) {
      adjustForm.setValue('warehouseId', count.warehouse.id)
    }
  }, [count, adjustForm])

  if (!count) return null

  const isInProgress = count.status === 'in_progress'
  const isScheduled = count.status === 'scheduled'
  const isCompleted = count.status === 'completed'
  const isCancelled = count.status === 'cancelled'

  function updateCounted(lineId: string, value: string) {
    setCountedQtyById((prev) => ({ ...prev, [lineId]: value }))
  }

  async function handleAddItem() {
    if (!count || !addItemId) return
    await onAddLine({ id: count.id, data: { itemId: addItemId } })
    setAddItemId('')
  }

  async function handleSubmitCount() {
    if (!count) return
    const validLines = lines
      .filter((l) => countedQtyById[l.id] !== undefined && countedQtyById[l.id] !== '')
      .map((l) => ({
        countLineId: l.id,
        countedQty: Number(countedQtyById[l.id]),
      }))

    if (validLines.length === 0) return

    await onSubmit({ id: count.id, data: { lines: validLines } })
  }

  const lineIds = new Set(lines.map((l) => l.itemId))
  const addableItems = items.filter((item) => !lineIds.has(item.id))

  const variantLines = lines.filter((l) => {
    const entered = countedQtyById[l.id]
    return entered !== undefined && entered !== '' && Number(entered) !== Number(l.expectedQty)
  })

  const fieldClass =
    'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center px-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Count Session</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {count.warehouse?.name ?? '—'} &bull;{' '}
              {new Date(count.scheduledDate ?? '').toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isScheduled && (
              <button
                type="button"
                onClick={() => onStart(count.id)}
                disabled={isStarting}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {isStarting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Start Count
              </button>
            )}
            {!isCompleted && !isCancelled && (
              <button
                type="button"
                onClick={() => onCancel(count.id)}
                disabled={isCancelling}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {isInProgress && (
          <div className="border-b border-zinc-200 px-6">
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setTab('count')}
                className={`border-b-2 py-3 text-sm font-medium transition-colors ${tab === 'count' ? 'border-prominent-purple-700 text-prominent-purple-700' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
              >
                Count Sheet
              </button>
              {canAdjust && (
                <button
                  type="button"
                  onClick={() => setTab('adjust')}
                  className={`border-b-2 py-3 text-sm font-medium transition-colors ${tab === 'adjust' ? 'border-prominent-purple-700 text-prominent-purple-700' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
                >
                  Create Adjustment
                </button>
              )}
            </div>
          </div>
        )}

        <div className="px-6 py-5">
          {(isScheduled || isCompleted || isCancelled) && (
            <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-4 text-sm text-zinc-600">
              <p>
                Status: <strong className="text-zinc-900 capitalize">{count.status}</strong>
              </p>
              {count.scheduledDate && (
                <p className="mt-1">
                  Scheduled: {new Date(count.scheduledDate).toLocaleDateString()}
                </p>
              )}
              {count.startedAt && (
                <p className="mt-1">Started: {new Date(count.startedAt).toLocaleDateString()}</p>
              )}
              {count.completedAt && (
                <p className="mt-1">
                  Completed: {new Date(count.completedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {isInProgress && tab === 'count' && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-500">
                Expected quantities below were captured by the system when this count started —
                enter what you actually counted.
              </p>

              {variantLines.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-800">
                    {variantLines.length} line(s) have variances. Review before submitting.
                  </p>
                </div>
              )}

              {isLoadingLines ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                </div>
              ) : (
                <div className="space-y-3">
                  {lines.map((line) => {
                    const entered = countedQtyById[line.id] ?? ''
                    const hasVariance =
                      entered !== '' && Number(entered) !== Number(line.expectedQty)
                    return (
                      <div key={line.id} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5">
                          <p className="truncate text-sm font-medium text-zinc-900">
                            {line.item?.name ?? line.itemId}
                          </p>
                          <p className="font-mono text-xs text-zinc-400">{line.item?.sku}</p>
                        </div>
                        <div className="col-span-2">
                          <p
                            className={`${fieldClass} border-transparent bg-zinc-50 text-zinc-600`}
                          >
                            {Number(line.expectedQty)}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            value={entered}
                            onChange={(e) => updateCounted(line.id, e.target.value)}
                            placeholder="Counted"
                            className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                              hasVariance ? 'border-amber-400 bg-amber-50' : ''
                            }`}
                          />
                        </div>
                        <div className="col-span-3 flex items-center justify-center text-sm font-semibold">
                          {entered !== '' ? (
                            <span className={hasVariance ? 'text-red-600' : 'text-green-600'}>
                              {Number(entered) - Number(line.expectedQty) >= 0 ? '+' : ''}
                              {Number(entered) - Number(line.expectedQty)}
                            </span>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {!isLoadingLines && lines.length === 0 && (
                <p className="text-center text-sm text-zinc-400 py-4">
                  No existing balances in this warehouse. Add an item below to begin counting.
                </p>
              )}

              <div className="flex items-center gap-2">
                <select
                  value={addItemId}
                  onChange={(e) => setAddItemId(e.target.value)}
                  className={`${fieldClass} bg-white`}
                >
                  <option value="">Add item not listed above…</option>
                  {addableItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} — {item.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!addItemId || isAddingLine}
                  className="flex shrink-0 items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:border-prominent-purple-400 hover:text-prominent-purple-700 disabled:opacity-50"
                >
                  {isAddingLine ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add
                </button>
              </div>

              {lines.length > 0 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSubmitCount}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isSubmitting ? 'Submitting…' : 'Submit Count'}
                  </button>
                </div>
              )}
            </div>
          )}

          {isInProgress && tab === 'adjust' && canAdjust && (
            <form
              onSubmit={adjustForm.handleSubmit(async (data) => {
                await onAdjust({ ...data, warehouseId: count.warehouse?.id ?? '' })
              })}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Reason Code <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="reasonCode"
                    control={adjustForm.control}
                    render={({ field }) => (
                      <select {...field} className={`${fieldClass} bg-white`}>
                        {reasonCodes.map((code) => (
                          <option key={code} value={code}>
                            {ADJUSTMENT_REASON_LABELS[code]}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="adjustmentDate"
                    control={adjustForm.control}
                    render={({ field }) => <input {...field} type="date" className={fieldClass} />}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Notes <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="notes"
                  control={adjustForm.control}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      rows={2}
                      placeholder="Explain the adjustment…"
                      className={`${fieldClass} resize-none`}
                    />
                  )}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-zinc-700">
                    Items <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => adjustLines.append({ itemId: '', expectedQty: 0, actualQty: 0 })}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-prominent-purple-400 hover:text-prominent-purple-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Line
                  </button>
                </div>

                {adjustLines.fields.length === 0 && (
                  <p className="rounded-lg border border-dashed border-zinc-200 py-4 text-center text-sm text-zinc-400">
                    Add at least one item to adjust.
                  </p>
                )}

                {adjustLines.fields.map((line, i) => (
                  <div key={line.id} className="grid grid-cols-12 items-start gap-2">
                    <div className="col-span-5">
                      <Controller
                        name={`lines.${i}.itemId`}
                        control={adjustForm.control}
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
                    </div>
                    <div className="col-span-3">
                      <Controller
                        name={`lines.${i}.expectedQty`}
                        control={adjustForm.control}
                        render={({ field }) => (
                          <input
                            {...field}
                            type="number"
                            placeholder="Expected"
                            className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                            onChange={(e) =>
                              field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                            }
                          />
                        )}
                      />
                    </div>
                    <div className="col-span-3">
                      <Controller
                        name={`lines.${i}.actualQty`}
                        control={adjustForm.control}
                        render={({ field }) => (
                          <input
                            {...field}
                            type="number"
                            min="0"
                            placeholder="Actual"
                            className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                            onChange={(e) =>
                              field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                            }
                          />
                        )}
                      />
                    </div>
                    <div className="col-span-1 flex items-center justify-center pt-2">
                      <button
                        type="button"
                        onClick={() => adjustLines.remove(i)}
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {typeof adjustForm.formState.errors.lines?.message === 'string' && (
                  <p className="text-xs text-red-600">
                    {adjustForm.formState.errors.lines.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isAdjusting}
                  className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {isAdjusting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isAdjusting ? 'Submitting…' : 'Submit Adjustment'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
