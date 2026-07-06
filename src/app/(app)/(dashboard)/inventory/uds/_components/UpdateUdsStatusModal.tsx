'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import {
  UpdateUdsStatusFormSchema,
  type UpdateUdsStatusFormValues,
  UDS_STATUSES,
  UDS_STATUS_LABELS,
  type UdsStatus,
} from '@/src/schema/inventory/uds'
import type { ApiResponse } from '@/src/libs/api/client'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: UpdateUdsStatusFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  currentStatus: UdsStatus
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

const ALLOWED_TRANSITIONS: Record<UdsStatus, UdsStatus[]> = {
  issued: ['in_transit', 'cancelled'],
  in_transit: ['received', 'cancelled'],
  received: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export default function UpdateUdsStatusModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  currentStatus,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateUdsStatusFormValues>({
    resolver: zodResolver(UpdateUdsStatusFormSchema),
    defaultValues: { status: ALLOWED_TRANSITIONS[currentStatus]?.[0] ?? currentStatus, notes: '' },
  })

  useEffect(() => {
    if (!isOpen)
      reset({ status: ALLOWED_TRANSITIONS[currentStatus]?.[0] ?? currentStatus, notes: '' })
  }, [isOpen, currentStatus, reset])

  if (!isOpen) return null

  const allowedStatuses = ALLOWED_TRANSITIONS[currentStatus] ?? []

  async function handleFormSubmit(data: UpdateUdsStatusFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Update UDS Status</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Current: <span className="font-medium">{UDS_STATUS_LABELS[currentStatus]}</span>
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

        {allowedStatuses.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-zinc-500">
            This UDS is already closed and cannot be updated.
          </div>
        ) : (
          <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  New Status <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={fieldClass}>
                      {UDS_STATUSES.filter((s) => allowedStatuses.includes(s)).map((s) => (
                        <option key={s} value={s}>
                          {UDS_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.status && (
                  <p className="mt-1 text-xs text-red-600">{errors.status.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Notes
                  <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
                </label>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      rows={2}
                      placeholder="Handover details, condition notes…"
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
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Updating…' : 'Update Status'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
