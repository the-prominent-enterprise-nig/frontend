'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, XCircle } from 'lucide-react'
import {
  RejectPriceListFormSchema,
  type RejectPriceListFormValues,
  type PriceList,
} from '@/src/schema/inventory/price-lists'
import { PLEX } from '@/src/libs/design/plex'

type Props = {
  open: boolean
  onClose: () => void
  priceList: PriceList | null
  onReject: (id: string, data: RejectPriceListFormValues) => Promise<void>
  isRejecting?: boolean
}

export function RejectPriceListModal({ open, onClose, priceList, onReject, isRejecting }: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RejectPriceListFormValues>({
    resolver: zodResolver(RejectPriceListFormSchema),
    defaultValues: { remarks: '' },
  })

  useEffect(() => {
    if (!open) reset({ remarks: '' })
  }, [open, reset])

  async function handleFormSubmit(data: RejectPriceListFormValues) {
    if (!priceList) return
    await onReject(priceList.id, data)
    onClose()
  }

  if (!open || !priceList) return null

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 ${PLEX}`}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e4e4e9] px-6 py-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-[#b42318]" />
            <h2 className="text-lg font-semibold text-[#17171c]">Reject Price List</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isRejecting}
            className="rounded-lg p-2 text-[#5b5b6b] hover:bg-[#f1f1f4] disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
          <div className="space-y-4 px-6 py-4">
            <div className="space-y-1 rounded-lg border border-[#e4e4e9] bg-[#fbfbfc] px-4 py-3">
              <p className="text-sm font-medium text-[#17171c]">{priceList.name}</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#3d3d4a]">
                Rejection Reason <span className="text-[#b42318]">*</span>
              </label>
              <Controller
                name="remarks"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={3}
                    placeholder="Provide a reason for rejection…"
                    className="w-full resize-none rounded-lg border border-[#e4e4e9] px-3 py-2 text-sm outline-none focus:border-[#b42318] focus:ring-1 focus:ring-[#f3c9c5]"
                  />
                )}
              />
              {errors.remarks && (
                <p className="mt-1 text-xs text-[#b42318]">{errors.remarks.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#e4e4e9] px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isRejecting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[#3d3d4a] hover:bg-[#f1f1f4] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRejecting}
              className="flex items-center gap-2 rounded-lg bg-[#b42318] px-4 py-2 text-sm font-medium text-white hover:bg-[#b42318] disabled:opacity-60"
            >
              {isRejecting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isRejecting ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
