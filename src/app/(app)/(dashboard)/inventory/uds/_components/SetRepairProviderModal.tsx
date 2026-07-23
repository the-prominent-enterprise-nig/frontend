'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import {
  SetRepairProviderFormSchema,
  type SetRepairProviderFormValues,
  type Uds,
} from '@/src/schema/inventory/uds'
import type { ApiResponse } from '@/src/libs/api/client'

type SupplierOption = { id: string; code: string; name: string }

const fieldClass =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

type Props = {
  uds: Uds | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: SetRepairProviderFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  supplierOptions: SupplierOption[]
}

export default function SetRepairProviderModal({
  uds,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  supplierOptions,
}: Props) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SetRepairProviderFormValues>({
    resolver: zodResolver(SetRepairProviderFormSchema),
    defaultValues: { repairProviderId: uds?.repairProviderId ?? '' },
  })

  if (!isOpen || !uds) return null

  async function handleFormSubmit(data: SetRepairProviderFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {uds.repairProvider ? 'Change Repair Provider' : 'Set Repair Provider'}
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

        <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
          <div className="space-y-4 px-6 py-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Repair Provider <span className="text-red-500">*</span>
              </label>
              <Controller
                name="repairProviderId"
                control={control}
                render={({ field }) => (
                  <select {...field} className={fieldClass}>
                    <option value="">— Select —</option>
                    {supplierOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.repairProviderId && (
                <p className="mt-1 text-xs text-red-600">{errors.repairProviderId.message}</p>
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
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
