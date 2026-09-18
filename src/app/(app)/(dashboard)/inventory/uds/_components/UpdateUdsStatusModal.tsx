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
  Wrench,
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
  type ManualUdsStatus,
} from '@/src/schema/inventory/uds'
import type { ApiResponse } from '@/src/libs/api/client'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: UpdateUdsStatusFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  currentStatus: UdsStatus
  /** A customer-owned sheet closes only through Release to Customer, which is
   *  what issues the DR and returns the serial to `sold`. The server refuses a
   *  `completed` here for one, so offering it would be a button that fails. */
  isCustodial?: boolean
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

/** Scenario 47 — `at_provider` and `repaired` are absent as *targets* on
 * purpose: dispatching and taking a unit back capture a DR/RR and an actual
 * cost, and the server refuses to reach either state through this endpoint.
 * `at_provider` offers nothing at all, because the unit is physically with the
 * provider until it is received back through its own form. */
const ALLOWED_TRANSITIONS: Record<UdsStatus, ManualUdsStatus[]> = {
  issued: ['in_transit', 'cancelled'],
  in_transit: ['received', 'cancelled'],
  received: ['completed', 'cancelled'],
  at_provider: [],
  repaired: ['completed'],
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
  at_provider: {
    icon: Wrench,
    description: 'With the service centre — take it back to move on',
    color: 'bg-amber-100 text-amber-700',
    ring: 'border-amber-500 ring-amber-500',
  },
  repaired: {
    icon: PackageCheck,
    description: 'Back from the service centre and in stock again',
    color: 'bg-teal-100 text-teal-700',
    ring: 'border-teal-500 ring-teal-500',
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
  isCustodial = false,
}: Props) {
  const allowedStatuses = (ALLOWED_TRANSITIONS[currentStatus] ?? []).filter(
    (s) => !(isCustodial && s === 'completed')
  )
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<UpdateUdsStatusFormValues>({
    resolver: zodResolver(UpdateUdsStatusFormSchema),
    defaultValues: {
      status: allowedStatuses[0] ?? currentStatus,
      notes: '',
      salesInvoiceNumber: '',
    },
  })
  const selectedStatus = watch('status')
  // The branch <-> main trip happens on exactly these two transitions: the
  // unit leaves for main, and it is back at the branch when the sheet closes.
  // Asking for the SI anywhere else would collect a number for a leg that
  // isn't being made, and the server would drop it.
  const siLeg =
    selectedStatus === 'in_transit'
      ? { label: 'SI for the transfer to main', hint: 'Raised by the branch with the unit' }
      : selectedStatus === 'completed'
        ? { label: 'SI for the return to branch', hint: 'Raised when the unit comes back' }
        : null

  useEffect(() => {
    if (!isOpen) {
      reset({
        status:
          (ALLOWED_TRANSITIONS[currentStatus] ?? []).filter(
            (s) => !(isCustodial && s === 'completed')
          )[0] ?? currentStatus,
        notes: '',
        salesInvoiceNumber: '',
      })
      setConfirmingCancel(false)
    }
  }, [isOpen, currentStatus, isCustodial, reset])

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
    <div className="absolute inset-0 z-50 flex flex-col bg-white">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[#17171c]">
              Update UDS Status
            </h2>
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
          <div className="flex-1 px-6 py-8 text-center text-sm text-zinc-500">
            {isCustodial
              ? 'This unit belongs to the customer — close it with Release to Customer, which issues the DR they sign for.'
              : 'This UDS is already closed and cannot be updated.'}
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(handleFormSubmit)}
            noValidate
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-y-auto px-6 py-5">
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

              {siLeg && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    {siLeg.label}
                    <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
                  </label>
                  <Controller
                    name="salesInvoiceNumber"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        maxLength={50}
                        placeholder="e.g. SI-20260914-0031"
                        className={fieldClass}
                      />
                    )}
                  />
                  <p className="mt-1 text-xs text-zinc-400">
                    {siLeg.hint} — the stock transfer records the movement, this records the paper
                    it was signed on.
                  </p>
                </div>
              )}

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

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
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
                className={`flex items-center gap-[7px] rounded-lg px-[15px] py-[9px] text-[13px] font-semibold text-white disabled:opacity-60 ${
                  selectedStatus === 'cancelled'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-[#5b21b6] hover:bg-[#4a189b]'
                }`}
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
