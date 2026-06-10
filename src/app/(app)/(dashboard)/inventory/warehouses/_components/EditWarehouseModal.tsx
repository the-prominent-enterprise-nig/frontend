'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import {
  UpdateWarehouseFormSchema,
  UpdateWarehouseFormValues,
  WarehouseSummary,
} from '@/src/schema/inventory/warehouses'
import type { ApiResponse } from '@/src/libs/api/client'

type Props = {
  isOpen: boolean
  warehouse: WarehouseSummary | null
  onClose: () => void
  onSubmit: (data: UpdateWarehouseFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
}

export default function EditWarehouseModal({
  isOpen,
  warehouse,
  onClose,
  onSubmit,
  isSubmitting,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateWarehouseFormValues>({
    resolver: zodResolver(UpdateWarehouseFormSchema),
    defaultValues: { code: '', name: '', address: '', status: 'active' },
  })

  useEffect(() => {
    if (warehouse) {
      reset({
        code: warehouse.code,
        name: warehouse.name,
        address: warehouse.address ?? '',
        status: warehouse.status ?? 'active',
      })
    }
  }, [warehouse, reset])

  useEffect(() => {
    if (!isOpen) reset()
  }, [isOpen, reset])

  if (!isOpen || !warehouse) return null

  async function handleFormSubmit(data: UpdateWarehouseFormValues) {
    const result = await onSubmit(data)
    if (result.success) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Edit Warehouse</h2>
            <p className="mt-0.5 text-sm text-zinc-500">Update warehouse details.</p>
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
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Code <span className="text-red-500">*</span>
              </label>
              <Controller
                name="code"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="e.g. WH-001"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm uppercase outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                )}
              />
              {errors.code && <p className="mt-1 text-xs text-red-600">{errors.code.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Status</label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                )}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Name <span className="text-red-500">*</span>
              </label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="e.g. Main Warehouse"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">Address</label>
              <Controller
                name="address"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={2}
                    placeholder="e.g. 123 Warehouse St, City"
                    className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
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
              {isSubmitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
