'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  X,
  Loader2,
  Check,
  ClipboardList,
  Truck,
  PackageCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import {
  UpdateUdsStatusFormSchema,
  type UpdateUdsStatusFormValues,
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

// Icon/description per status — colors reuse UDS_STATUS_STYLES so this stays
// visually consistent with the badges shown everywhere else in the module.
const STATUS_META: Record<
  UdsStatus,
  { icon: typeof ClipboardList; description: string; color: string; ring: string }
> = {
  issued: {
    icon: ClipboardList,
    description: 'Document issued — unit has not moved yet',
    color: 'bg-blue-100 text-blue-700',
    ring: 'border-blue-500 ring-blue-500',
  },
  in_transit: {
    icon: Truck,
    description: 'Unit is currently being moved',
    color: 'bg-yellow-100 text-yellow-700',
    ring: 'border-yellow-500 ring-yellow-500',
  },
  received: {
    icon: PackageCheck,
    description: 'Unit has arrived and been received',
    color: 'bg-purple-100 text-purple-700',
    ring: 'border-purple-500 ring-purple-500',
  },
  completed: {
    icon: CheckCircle2,
    description: 'Process fully completed — unit returns to stock',
    color: 'bg-green-100 text-green-700',
    ring: 'border-green-500 ring-green-500',
  },
  cancelled: {
    icon: XCircle,
    description: 'Document cancelled — no further action',
    color: 'bg-zinc-100 text-zinc-500',
    ring: 'border-zinc-500 ring-zinc-500',
  },
}

export default function UpdateUdsStatusModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  currentStatus,
}: Props) {
  const allowedStatuses = ALLOWED_TRANSITIONS[currentStatus] ?? []
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<UpdateUdsStatusFormValues>({
    resolver: zodResolver(UpdateUdsStatusFormSchema),
    defaultValues: { status: allowedStatuses[0] ?? currentStatus, notes: '' },
  })
  const selectedStatus = watch('status')

  useEffect(() => {
    if (!isOpen) {
      reset({ status: ALLOWED_TRANSITIONS[currentStatus]?.[0] ?? currentStatus, notes: '' })
      setConfirmingCancel(false)
    }
  }, [isOpen, currentStatus, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: UpdateUdsStatusFormValues) {
    if (data.status === 'cancelled' && !confirmingCancel) {
      setConfirmingCancel(true)
      return
    }
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
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  New Status <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-2">
                      {allowedStatuses.map((s) => {
                        const meta = STATUS_META[s]
                        const Icon = meta.icon
                        const isSelected = field.value === s
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              field.onChange(s)
                              setConfirmingCancel(false)
                            }}
                            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                              isSelected
                                ? `${meta.ring} ring-1 bg-zinc-50`
                                : 'border-zinc-200 hover:bg-zinc-50'
                            }`}
                          >
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.color}`}
                            >
                              <Icon className="h-4.5 w-4.5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-zinc-900">
                                {UDS_STATUS_LABELS[s]}
                              </span>
                              <span className="block text-xs text-zinc-500">
                                {meta.description}
                              </span>
                            </span>
                            {isSelected && (
                              <Check className="h-4 w-4 shrink-0 text-prominent-purple-700" />
                            )}
                          </button>
                        )
                      })}
                    </div>
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

              {selectedStatus === 'cancelled' && confirmingCancel && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <p className="text-xs text-red-700">
                    Cancelling closes this document permanently and cannot be undone. Click{' '}
                    <span className="font-medium">Confirm Cancel</span> below to proceed.
                  </p>
                </div>
              )}
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
                  selectedStatus === 'cancelled'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-prominent-purple-700 hover:bg-prominent-purple-800'
                }`}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting
                  ? 'Updating…'
                  : selectedStatus === 'cancelled' && confirmingCancel
                    ? 'Confirm Cancel'
                    : 'Update Status'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
