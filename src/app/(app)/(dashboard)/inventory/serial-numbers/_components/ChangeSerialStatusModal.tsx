'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import {
  UpdateSerialStatusFormSchema,
  SERIAL_STATUS_LABELS,
  SERIAL_STATUS_COLORS,
  SerialStatusSchema,
  type UpdateSerialStatusFormValues,
  type SerialNumberSummary,
} from '@/src/schema/inventory/serial-numbers'
import type { ApiResponse } from '@/src/libs/api/client'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { StatusBadge } from '@/src/components/ui/StatusBadge'
import { locationLabel } from '@/src/libs/format/locationLabel'
import type { WarehouseSummary } from '@/src/schema/inventory/warehouses'

type Option = { id: string; name: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  serial: SerialNumberSummary | null
  onSubmit: (id: string, data: UpdateSerialStatusFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  warehouses: WarehouseSummary[]
  customers: Option[]
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

const defaultValues: UpdateSerialStatusFormValues = {
  status: 'in_stock',
  warehouseId: '',
  soldToCustomerId: '',
  saleDate: '',
}

export default function ChangeSerialStatusModal({
  isOpen,
  onClose,
  serial,
  onSubmit,
  isSubmitting,
  warehouses,
  customers,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<UpdateSerialStatusFormValues>({
    resolver: zodResolver(UpdateSerialStatusFormSchema),
    defaultValues,
  })

  const nextStatus = watch('status')

  useEffect(() => {
    if (isOpen && serial) {
      reset({ ...defaultValues, status: serial.status })
    } else if (!isOpen) {
      reset(defaultValues)
    }
  }, [isOpen, serial, reset])

  if (!isOpen || !serial) return null

  // Rebound to a non-null local so the closure below stays narrowed —
  // `serial` itself is a prop TS won't treat as provably non-null inside a
  // nested function declaration even after the guard above.
  const currentSerial = serial

  async function handleFormSubmit(data: UpdateSerialStatusFormValues) {
    // Sending unrelated fields for a non-sale status would be harmless
    // server-side (they're optional there too), but trimming them here keeps
    // the request honest about what actually changed.
    const payload: UpdateSerialStatusFormValues =
      data.status === 'sold'
        ? data
        : { status: data.status, warehouseId: data.warehouseId || undefined }
    const result = await onSubmit(currentSerial.id, payload)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-start justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-zinc-900">Change Status</h2>
            <div className="mt-1 flex items-center gap-2">
              <span className="truncate font-mono text-sm text-zinc-600">
                {serial.serialNumber}
              </span>
              <StatusBadge
                label={SERIAL_STATUS_LABELS[serial.status]}
                colorClassName={SERIAL_STATUS_COLORS[serial.status]}
                size="xs"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
          <div className="space-y-5 px-6 py-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">New Status</label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <select {...field} className={fieldClass}>
                    {/* In Transit only comes from dispatching a transfer */}
                    {SerialStatusSchema.options
                      .filter((s) => s !== 'in_transit' || s === serial.status)
                      .map((s) => (
                        <option key={s} value={s}>
                          {SERIAL_STATUS_LABELS[s]}
                          {s === serial.status ? ' (current)' : ''}
                        </option>
                      ))}
                  </select>
                )}
              />
            </div>

            {nextStatus === 'sold' && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Sold To <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="soldToCustomerId"
                    control={control}
                    render={({ field }) => (
                      <SearchableSelect
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        placeholder="Search customer…"
                        options={customers.map((c) => ({ value: c.id, label: c.name }))}
                      />
                    )}
                  />
                  {errors.soldToCustomerId && (
                    <p className="mt-1 text-xs text-red-600">{errors.soldToCustomerId.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Sale Date <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="saleDate"
                    control={control}
                    render={({ field }) => <input {...field} type="date" className={fieldClass} />}
                  />
                  {errors.saleDate && (
                    <p className="mt-1 text-xs text-red-600">{errors.saleDate.message}</p>
                  )}
                </div>
              </>
            )}

            {nextStatus !== 'sold' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  New Location <span className="text-zinc-400">(optional)</span>
                </label>
                <Controller
                  name="warehouseId"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={fieldClass}>
                      <option value="">Keep current location</option>
                      {warehouses.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {locationLabel(wh)}
                        </option>
                      ))}
                    </select>
                  )}
                />
                <p className="mt-1 text-xs text-zinc-400">
                  Only needed for a transfer or a return to a different location.
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
              disabled={isSubmitting || nextStatus === serial.status}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Updating…' : 'Update Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
