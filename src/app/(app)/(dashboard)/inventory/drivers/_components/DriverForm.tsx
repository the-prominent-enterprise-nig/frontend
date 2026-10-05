'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import {
  DriverFormSchema,
  type DriverListItem,
  type VehicleCategory,
} from '@/src/schema/inventory/vehicles'
import { saveDriver } from '../_actions/save-driver'
import { getBranches } from '../_actions/get-branches'

const BACK_HREF = '/inventory/master-data?tab=drivers'

const CATEGORIES: { value: VehicleCategory; label: string }[] = [
  { value: 'delivery', label: 'Delivery' },
  { value: 'service', label: 'Service' },
  { value: 'collector', label: 'Collector' },
]

const INPUT =
  'mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

export function DriverForm({
  driver,
  branchLocked,
}: {
  driver?: DriverListItem
  branchLocked: boolean
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const isEdit = Boolean(driver)

  const [form, setForm] = useState({
    driverName: driver?.driverName ?? '',
    plateNo: driver?.plateNo ?? '',
    category: (driver?.category ?? 'delivery') as VehicleCategory,
    contactNumber: driver?.contactNumber ?? '',
    tag: driver?.tag ?? '',
    branchId: driver?.branch?.id ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // A branch-assigned user is forced into their own branch server-side.
  const branchesQuery = useQuery({
    queryKey: ['inventory-drivers-branches'],
    queryFn: () => getBranches(),
    enabled: !branchLocked,
    staleTime: 10 * 60 * 1000,
  })
  const branches = branchesQuery.data?.data?.data ?? []

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    const parsed = DriverFormSchema.safeParse(form)
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      parsed.error.issues.forEach((i) => {
        errs[String(i.path[0])] = i.message
      })
      setErrors(errs)
      return
    }
    setErrors({})

    setSubmitting(true)
    const res = await saveDriver(driver?.id ?? null, parsed.data)
    setSubmitting(false)

    if (!res.success) {
      setServerError(res.message || res.error || 'Failed to save driver')
      return
    }
    showToast({ title: res.message ?? 'Saved', status: 'success' })
    await queryClient.invalidateQueries({ queryKey: ['inventory-drivers'] })
    router.push(BACK_HREF)
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-[14px] min-[1080px]:px-5 min-[1080px]:py-[22px]">
      <Link
        href={BACK_HREF}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to drivers
      </Link>

      <h1 className="text-[21px] font-semibold tracking-[-0.015em] text-prominent-purple-900">
        {isEdit ? 'Edit Driver' : 'Add Driver'}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        {isEdit
          ? 'Update this driver’s details on the fleet roster.'
          : 'Add a driver and their vehicle to the fleet roster.'}
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-6 w-full space-y-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Field label="Driver name *" error={errors.driverName}>
            <input
              id="driverName"
              value={form.driverName}
              onChange={(e) => setField('driverName', e.target.value)}
              placeholder="Juan Dela Cruz"
              className={INPUT}
            />
          </Field>
          <Field label="Contact number" error={errors.contactNumber}>
            <input
              id="contactNumber"
              value={form.contactNumber}
              onChange={(e) => setField('contactNumber', e.target.value)}
              placeholder="0917 123 4567"
              className={INPUT}
            />
          </Field>
          <Field label="Plate no. *" error={errors.plateNo}>
            <input
              id="plateNo"
              value={form.plateNo}
              onChange={(e) => setField('plateNo', e.target.value)}
              placeholder="ABC 1234"
              className={INPUT}
            />
          </Field>
          <Field label="Category *" error={errors.category}>
            <select
              id="category"
              value={form.category}
              onChange={(e) => setField('category', e.target.value as VehicleCategory)}
              className={INPUT}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          {!branchLocked && (
            <div>
              <label className="block text-[13px] font-medium text-zinc-700">Branch</label>
              <div className="mt-1">
                <SearchableSelect
                  options={branches.map((b) => ({ value: b.id, label: b.name }))}
                  value={form.branchId}
                  onChange={(v) => setField('branchId', v)}
                  placeholder="Unassigned"
                  loading={branchesQuery.isLoading}
                  clearable
                />
              </div>
              {errors.branchId && (
                <p className="mt-1 text-[12px] text-red-600">{errors.branchId}</p>
              )}
            </div>
          )}
          <Field label="Tag / Area" error={errors.tag}>
            <input
              id="tag"
              value={form.tag}
              onChange={(e) => setField('tag', e.target.value)}
              placeholder="e.g. TOP DOWN, TRUCK, AIRCOOL"
              className={INPUT}
            />
          </Field>
        </div>

        {serverError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
        )}

        <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-end">
          <Link
            href={BACK_HREF}
            className="w-full rounded-lg px-4 py-2 text-center text-sm font-medium text-zinc-600 hover:bg-zinc-100 sm:w-auto"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-purple-800 disabled:opacity-50 sm:w-auto"
          >
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add driver'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-zinc-700">
        {label}
        {children}
      </label>
      {error && <p className="mt-1 text-[12px] text-red-600">{error}</p>}
    </div>
  )
}
