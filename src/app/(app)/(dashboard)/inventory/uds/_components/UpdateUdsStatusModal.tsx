'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, AlertTriangle } from 'lucide-react'
import {
  UpdateUdsStatusFormSchema,
  type UpdateUdsStatusFormValues,
  type ManualUdsStatus,
} from '@/src/schema/inventory/uds'
import type { ApiResponse } from '@/src/libs/api/client'
import Tooltip from '@/src/components/ui/Tooltip'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: UpdateUdsStatusFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  /** The one step the list's button stands for — there is no picker. */
  target: ManualUdsStatus
  udsCode: string
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

/**
 * Scenario 72 Part 10 — the few hops no other document records: a customer's
 * unit going to and arriving at main (no stock transfer can carry someone
 * else's property), closing a sheet with no trip home, and cancelling. Every
 * other hop now happens on its own document — the ticket's stock transfer,
 * the DR to the service centre or customer, the RR back — so this is a
 * confirmation for one step, not a status picker.
 */
const STEPS: Partial<Record<ManualUdsStatus, { title: string; body: string; action: string }>> = {
  in_transit: {
    title: 'Send to Main',
    body: 'The unit leaves for main for assessment. A gate pass number is issued for the trip.',
    action: 'Send to Main',
  },
  received: {
    title: 'Receive at Main',
    body: 'The unit has arrived at main and is ready to be assessed.',
    action: 'Receive at Main',
  },
  completed: {
    title: 'Complete',
    body: 'Closes this sheet. Our own unit goes back to in stock.',
    action: 'Complete',
  },
  cancelled: {
    title: 'Cancel UDS',
    body: 'Closes this sheet without finishing it. The unit goes back to in stock, and a transfer still waiting to leave is cancelled with it.',
    action: 'Cancel UDS',
  },
}

export default function UpdateUdsStatusModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  target,
  udsCode,
}: Props) {
  const step = STEPS[target] ?? { title: 'Update UDS', body: '', action: 'Confirm' }
  const isCancel = target === 'cancelled'
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  // Mounted fresh on every open (the list renders it only while a step is
  // chosen), so its defaults are always this step's.
  const { control, handleSubmit } = useForm<UpdateUdsStatusFormValues>({
    resolver: zodResolver(UpdateUdsStatusFormSchema),
    defaultValues: { status: target, notes: '' },
  })

  if (!isOpen) return null

  async function handleFormSubmit(data: UpdateUdsStatusFormValues) {
    if (isCancel && !confirmingCancel) {
      setConfirmingCancel(true)
      return
    }
    const result = await onSubmit({ ...data, status: target })
    if (result.success) onClose()
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-white">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[#17171c]">
              {step.title}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">{udsCode}</p>
          </div>
          <Tooltip label="Close">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
          </Tooltip>
        </div>

        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <p className="text-sm text-zinc-600">{step.body}</p>

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

            {isCancel && confirmingCancel && (
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
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex items-center gap-1.75 rounded-lg px-3.75 py-2.25 text-[13px] font-semibold text-white disabled:opacity-60 ${
                isCancel ? 'bg-red-600 hover:bg-red-700' : 'bg-[#5b21b6] hover:bg-[#4a189b]'
              }`}
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isSubmitting
                ? 'Saving…'
                : isCancel && confirmingCancel
                  ? 'Confirm Cancel'
                  : step.action}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
