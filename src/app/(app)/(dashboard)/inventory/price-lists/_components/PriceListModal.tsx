'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import { PriceListFormSchema, type PriceListFormValues } from '@/src/schema/inventory/price-lists'
import type { ApiResponse } from '@/src/libs/api/client'
import type { Currency } from '../_actions/get-currencies'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: PriceListFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  currencies: Currency[]
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

export default function PriceListModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  currencies,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PriceListFormValues>({
    resolver: zodResolver(PriceListFormSchema),
    defaultValues: {
      name: '',
      listType: 'standard',
      description: '',
      currency: '',
      effectiveFrom: undefined,
      effectiveTo: undefined,
      priority: 0,
      status: 'active',
    },
  })

  useEffect(() => {
    if (!isOpen) {
      reset({
        name: '',
        listType: 'standard',
        description: '',
        currency: '',
        effectiveFrom: undefined,
        effectiveTo: undefined,
        priority: 0,
        status: 'active',
      })
    }
  }, [isOpen, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: PriceListFormValues) {
    const result = await onSubmit({
      ...data,
      effectiveFrom: data.effectiveFrom || undefined,
      effectiveTo: data.effectiveTo || undefined,
    })
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">New Price List</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Create a new pricing tier for your inventory items.
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
            <div>
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
                    placeholder="e.g. Retail Standard 2026"
                    className={fieldClass}
                  />
                )}
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  List Type <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="listType"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      <option value="standard">Standard</option>
                      <option value="promotional">Promotional</option>
                      <option value="contract">Contract</option>
                      <option value="wholesale">Wholesale</option>
                    </select>
                  )}
                />
                {errors.listType && (
                  <p className="mt-1 text-xs text-red-600">{errors.listType.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Currency</label>
                <Controller
                  name="currency"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      <option value="">Select currency…</option>
                      {currencies.map((c) => (
                        <option key={c.id} value={c.code}>
                          {c.code} – {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.currency && (
                  <p className="mt-1 text-xs text-red-600">{errors.currency.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Description{' '}
                <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
              </label>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={2}
                    placeholder="Brief description of this price list…"
                    className={`${fieldClass} resize-none`}
                  />
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Effective From{' '}
                  <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
                </label>
                <Controller
                  name="effectiveFrom"
                  control={control}
                  render={({ field }) => <input {...field} type="date" className={fieldClass} />}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Effective To{' '}
                  <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
                </label>
                <Controller
                  name="effectiveTo"
                  control={control}
                  render={({ field }) => <input {...field} type="date" className={fieldClass} />}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Priority</label>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="number"
                      step="1"
                      placeholder="0"
                      className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? 0 : Number(e.target.value))
                      }
                    />
                  )}
                />
                {errors.priority && (
                  <p className="mt-1 text-xs text-red-600">{errors.priority.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Status</label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="archived">Archived</option>
                    </select>
                  )}
                />
              </div>
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
              {isSubmitting ? 'Saving…' : 'Create Price List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
