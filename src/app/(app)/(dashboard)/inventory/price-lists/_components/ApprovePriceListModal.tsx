'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, CheckCircle } from 'lucide-react'
import {
  ApprovePriceListFormSchema,
  type ApprovePriceListFormValues,
  type PriceList,
} from '@/src/schema/inventory/price-lists'
import { PLEX } from '@/src/libs/design/plex'

type Props = {
  open: boolean
  onClose: () => void
  priceList: PriceList | null
  onApprove: (id: string, data: ApprovePriceListFormValues) => Promise<void>
  isApproving?: boolean
}

export function ApprovePriceListModal({ open, onClose, priceList, onApprove, isApproving }: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ApprovePriceListFormValues>({
    resolver: zodResolver(ApprovePriceListFormSchema),
    defaultValues: { remarks: '' },
  })

  useEffect(() => {
    if (!open) reset({ remarks: '' })
  }, [open, reset])

  async function handleFormSubmit(data: ApprovePriceListFormValues) {
    if (!priceList) return
    await onApprove(priceList.id, data)
    onClose()
  }

  if (!open || !priceList) return null

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 ${PLEX}`}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e4e4e9] px-6 py-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-[#0f7b52]" />
            <h2 className="text-lg font-semibold text-[#17171c]">Approve Price List</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isApproving}
            className="rounded-lg p-2 text-[#5b5b6b] hover:bg-[#f1f1f4] disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
          <div className="space-y-4 px-6 py-4">
            <div className="space-y-1 rounded-lg border border-[#e4e4e9] bg-[#fbfbfc] px-4 py-3">
              <p className="text-sm font-medium text-[#17171c]">{priceList.name}</p>
              <p className="text-xs text-[#5b5b6b]">
                {priceList.allowedBranchIds?.length
                  ? `${priceList.allowedBranchIds.length} branch(es)`
                  : 'All branches'}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#3d3d4a]">
                Remarks <span className="font-normal text-[#8b8b9b]">(optional)</span>
              </label>
              <Controller
                name="remarks"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    value={field.value ?? ''}
                    rows={3}
                    placeholder="Optional approval remarks…"
                    className="w-full resize-none rounded-lg border border-[#e4e4e9] px-3 py-2 text-sm outline-none focus:border-[#5b21b6] focus:ring-1 focus:ring-[#5b21b6]"
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
              disabled={isApproving}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[#3d3d4a] hover:bg-[#f1f1f4] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isApproving}
              className="flex items-center gap-2 rounded-lg bg-[#0f7b52] px-4 py-2 text-sm font-medium text-white hover:bg-[#0b6644] disabled:opacity-60"
            >
              {isApproving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isApproving ? 'Approving…' : 'Approve'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
