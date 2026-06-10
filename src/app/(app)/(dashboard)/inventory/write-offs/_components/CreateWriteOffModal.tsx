'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, AlertTriangle, Upload, Paperclip } from 'lucide-react'
import {
  CreateWriteOffFormSchema,
  CreateWriteOffFormValues,
  REASON_CODE_LABELS,
  WriteOffReasonCodeSchema,
} from '@/src/schema/inventory/write-offs'
import type { WarehouseSummary } from '@/src/schema/inventory/warehouses'
import type { ItemSummary } from '@/src/schema/inventory/items'
import type { ApiResponse } from '@/src/libs/api/client'
import { uploadWriteOffPhoto, attachWriteOffPhoto } from '../_actions/write-off-photos'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateWriteOffFormValues) => Promise<ApiResponse<{ id: string }>>
  isSubmitting: boolean
  warehouses: WarehouseSummary[]
  items: ItemSummary[]
}

const reasonCodes = WriteOffReasonCodeSchema.options

export default function CreateWriteOffModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  warehouses,
  items,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateWriteOffFormValues>({
    resolver: zodResolver(CreateWriteOffFormSchema),
    defaultValues: {
      reasonCode: 'damaged',
      notes: '',
      unitCost: 0,
    },
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      reset({ reasonCode: 'damaged', notes: '', unitCost: 0 })
      setPendingFiles([])
    }
  }, [isOpen, reset])

  if (!isOpen) return null

  function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) setPendingFiles((prev) => [...prev, ...files])
    e.target.value = ''
  }

  function removePendingFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleFormSubmit(data: CreateWriteOffFormValues) {
    const result = await onSubmit(data)
    if (!result.success) return

    const writeOffId = result.data?.id

    if (writeOffId && pendingFiles.length > 0) {
      setIsUploadingPhotos(true)
      for (const file of pendingFiles) {
        const fd = new FormData()
        fd.append('file', file)
        const uploadResult = await uploadWriteOffPhoto(fd)
        if (uploadResult.success && uploadResult.data?.id) {
          await attachWriteOffPhoto(writeOffId, uploadResult.data.id)
        }
      }
      setIsUploadingPhotos(false)
    }

    onClose()
  }

  const isBusy = isSubmitting || isUploadingPhotos

  const fieldClass =
    'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Record Stock Write-off</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Posts an expense to the Inventory Loss account automatically.
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
            {/* Item */}
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

            {/* Warehouse + Quantity */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Warehouse <span className="text-red-500">*</span>
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
                  Quantity <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="quantity"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="e.g. 10"
                      className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                      }
                    />
                  )}
                />
                {errors.quantity && (
                  <p className="mt-1 text-xs text-red-600">{errors.quantity.message}</p>
                )}
              </div>
            </div>

            {/* Reason Code + Date */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Reason Code <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="reasonCode"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      {reasonCodes.map((code) => (
                        <option key={code} value={code}>
                          {REASON_CODE_LABELS[code]}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.reasonCode && (
                  <p className="mt-1 text-xs text-red-600">{errors.reasonCode.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Write-off Date <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="writeOffDate"
                  control={control}
                  render={({ field }) => <input {...field} type="date" className={fieldClass} />}
                />
                {errors.writeOffDate && (
                  <p className="mt-1 text-xs text-red-600">{errors.writeOffDate.message}</p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Supporting Note <span className="text-red-500">*</span>
              </label>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={3}
                    placeholder="Describe the loss in detail (condition, cause, location, etc.)"
                    className={`${fieldClass} resize-none`}
                  />
                )}
              />
              {errors.notes && <p className="mt-1 text-xs text-red-600">{errors.notes.message}</p>}
            </div>

            {/* Photo Attachments */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-700">
                  Photo Evidence
                  <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Add Photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileAdd}
                />
              </div>

              {pendingFiles.length > 0 ? (
                <ul className="space-y-1.5">
                  {pendingFiles.map((file, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                        <span className="truncate text-xs text-zinc-700">{file.name}</span>
                        <span className="shrink-0 text-[10px] text-zinc-400">
                          {(file.size / 1024).toFixed(0)} KB
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePendingFile(i)}
                        disabled={isBusy}
                        className="ml-2 shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg border border-dashed border-zinc-200 py-3 text-center text-xs text-zinc-400">
                  No photos attached
                </p>
              )}
            </div>

            {/* Accounting notice */}
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-800">
                Submitting this form will <strong>reduce on-hand stock</strong> and automatically
                post an <strong>Inventory Loss</strong> expense entry to accounting. This action
                cannot be undone.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isUploadingPhotos
                ? 'Attaching photos…'
                : isSubmitting
                  ? 'Recording…'
                  : 'Record Write-off'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
