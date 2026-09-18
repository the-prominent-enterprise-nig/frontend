'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { X, Loader2, UserCheck, FileText } from 'lucide-react'
import {
  ReleaseToCustomerFormSchema,
  type ReleaseToCustomerFormValues,
  type Uds,
} from '@/src/schema/inventory/uds'
import type { ApiResponse } from '@/src/libs/api/client'

type ReleaseToCustomerFormInput = z.input<typeof ReleaseToCustomerFormSchema>

const fieldClass =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

const defaultValues: ReleaseToCustomerFormInput = {
  salesInvoiceNumber: '',
  notes: '',
}

type Props = {
  uds: Uds | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ReleaseToCustomerFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
}

/**
 * The closing leg: the unit goes back to its customer on a DR.
 *
 * Posts nothing and moves no stock — the unit was never ours (the intake is
 * custodial, see StockService.processReturn), so handing it back is a change
 * of custody. Charging the customer for the repair, if they are charged at
 * all, is a separate AR invoice.
 */
export default function ReleaseToCustomerModal({
  uds,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReleaseToCustomerFormInput, unknown, ReleaseToCustomerFormValues>({
    resolver: zodResolver(ReleaseToCustomerFormSchema),
    defaultValues,
  })

  useEffect(() => {
    if (!isOpen) reset(defaultValues)
  }, [isOpen, reset])

  if (!isOpen || !uds) return null

  // Mirrors the server's own rule so the clerk is told before submitting
  // rather than after. A unit going back with no verdict is allowed; a unit
  // going back with neither a verdict nor an explanation is not.
  const needsReason = !uds.assessment

  async function handleFormSubmit(data: ReleaseToCustomerFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-white">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[#17171c]">
              Release to Customer
            </h2>
            <p className="mt-0.5 font-mono text-xs text-zinc-400">{uds.code}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p className="text-xs text-emerald-800">
                Hands the unit back to{' '}
                <span className="font-medium">{uds.customer?.name ?? 'the customer'}</span> and
                closes the job. Nothing is posted and no stock moves — the unit was theirs all
                along.
              </p>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
              <p className="text-xs text-zinc-600">
                A <strong>DR number</strong> will be issued when you confirm. Write it on the
                customer&apos;s copy — it is shown as soon as the release is saved.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                SI for the return to branch
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
                The unit came back to the branch to be collected — this records the paper that leg
                travelled on.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Notes
                {needsReason ? (
                  <span className="text-red-500"> *</span>
                ) : (
                  <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
                )}
              </label>
              <Controller
                name="notes"
                control={control}
                rules={
                  needsReason
                    ? {
                        validate: (v) => !!v?.trim() || 'Say why the unit is going back unassessed',
                      }
                    : undefined
                }
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={2}
                    placeholder={
                      needsReason
                        ? 'Nothing was found wrong, customer withdrew the request…'
                        : 'Collected by, condition on release…'
                    }
                    className={`${fieldClass} resize-none`}
                  />
                )}
              />
              {needsReason && !errors.notes && (
                <p className="mt-1 text-xs text-zinc-400">
                  This unit has no assessment on record, so the sheet needs to say why it is going
                  back untouched.
                </p>
              )}
              {errors.notes && <p className="mt-1 text-xs text-red-600">{errors.notes.message}</p>}
            </div>
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
              className="flex items-center gap-[7px] rounded-lg bg-[#5b21b6] px-[15px] py-[9px] text-[13px] font-semibold text-white hover:bg-[#4a189b] disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isSubmitting ? 'Releasing…' : 'Release to Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
