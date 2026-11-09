'use client'

import { useEffect, type ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { Modal } from '@/src/components/ui/Modal'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import type { SupplierListItem } from '@/src/schema/inventory/suppliers'
import {
  ServiceCenterFormSchema,
  type ServiceCenterFormValues,
} from '@/src/schema/inventory/service-centers'

type Props = {
  open: boolean
  /** null = adding a new service center. */
  target: SupplierListItem | null
  onClose: () => void
  onSubmit: (values: ServiceCenterFormValues) => Promise<unknown>
  isSubmitting: boolean
}

const EMPTY: ServiceCenterFormValues = { name: '', address: '', status: 'active' }

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'blacklisted', label: 'Blacklisted' },
]

const INPUT =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none placeholder:text-ink-faint focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

function toFormValues(sc: SupplierListItem): ServiceCenterFormValues {
  return { name: sc.name, address: sc.address ?? '', status: sc.status }
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: ReactNode
}): ReactNode {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function Footer({
  isEdit,
  isSubmitting,
  onClose,
}: {
  isEdit: boolean
  isSubmitting: boolean
  onClose: () => void
}): ReactNode {
  return (
    <div className="flex items-center justify-end gap-3">
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
        form="service-center-form"
        disabled={isSubmitting}
        className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Service Center'}
      </button>
    </div>
  )
}

export function ServiceCenterFormModal({
  open,
  target,
  onClose,
  onSubmit,
  isSubmitting,
}: Props): ReactNode {
  const isEdit = target !== null
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ServiceCenterFormValues>({
    resolver: zodResolver(ServiceCenterFormSchema),
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (open) reset(target ? toFormValues(target) : EMPTY)
  }, [open, target, reset])

  async function submit(values: ServiceCenterFormValues): Promise<void> {
    try {
      await onSubmit(values)
      onClose()
    } catch {
      // The hook already toasted the error; keep the modal open to fix it.
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Service Center' : 'Add Service Center'}
      description="Repair providers offered when a unit is sent out for repair."
      footer={<Footer isEdit={isEdit} isSubmitting={isSubmitting} onClose={onClose} />}
    >
      <form
        id="service-center-form"
        onSubmit={handleSubmit(submit)}
        noValidate
        className="space-y-4"
      >
        <Field label="Name" required error={errors.name?.message}>
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="text"
                placeholder="e.g. Honda Service Center"
                className={INPUT}
              />
            )}
          />
        </Field>

        <Field label="Address" error={errors.address?.message}>
          <Controller
            name="address"
            control={control}
            render={({ field }) => (
              <textarea
                {...field}
                value={field.value ?? ''}
                rows={3}
                placeholder="e.g. 123 Rizal Ave., Dagupan City"
                className={`${INPUT} resize-none`}
              />
            )}
          />
        </Field>

        {isEdit && (
          <Field label="Status">
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  value={field.value}
                  onChange={(v) => field.onChange(v || 'active')}
                  options={STATUS_OPTIONS}
                />
              )}
            />
          </Field>
        )}
      </form>
    </Modal>
  )
}
