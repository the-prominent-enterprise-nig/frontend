'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { DriverFormSchema, type Driver } from '@/src/schema/inventory/drivers'
import { saveDriver } from '../_actions/save-driver'
import { getBranches } from '../_actions/get-branches'

const BACK_HREF = '/accounting/drivers'

const INPUT =
  'mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500'

export function DriverForm({ driver, branchLocked }: { driver?: Driver; branchLocked: boolean }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const isEdit = Boolean(driver)

  const [form, setForm] = useState({
    name: driver?.name ?? '',
    contactNumber: driver?.contactNumber ?? '',
    branchId: driver?.branch?.id ?? driver?.branchId ?? '',
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
    if (submitting) return
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
    let res: Awaited<ReturnType<typeof saveDriver>>
    try {
      res = await saveDriver(driver?.id ?? null, parsed.data)
    } catch {
      setSubmitting(false)
      setServerError('Could not reach the server. Your changes were not saved — please try again.')
      return
    }

    // The form stays locked on success until the page navigates away, so nothing
    // can be edited between the save landing and the redirect.
    if (!res.success) {
      setSubmitting(false)
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
        aria-disabled={submitting}
        tabIndex={submitting ? -1 : undefined}
        onClick={(e) => {
          if (submitting) e.preventDefault()
        }}
        className={`mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 ${submitting ? 'pointer-events-none opacity-50' : ''}`}
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
          : 'Add a driver to the fleet roster.'}
      </p>

      <form
        onSubmit={onSubmit}
        aria-busy={submitting}
        className="mt-4 w-full border-t border-zinc-200 pt-5"
      >
        <fieldset disabled={submitting} className="m-0 min-w-0 space-y-5 border-0 p-0">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            <Field label="Driver name *" error={errors.name}>
              <input
                id="driverName"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
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
            {!branchLocked && (
              <div>
                <label className="block text-[13px] font-medium text-zinc-700">Branch</label>
                <div className="mt-1">
                  <SearchableSelect
                    options={branches.map((b) => ({ value: b.id, label: b.name }))}
                    value={form.branchId}
                    onChange={(v) => setField('branchId', v)}
                    placeholder="Unassigned"
                    disabled={submitting}
                    loading={branchesQuery.isLoading}
                    clearable
                  />
                </div>
                {errors.branchId && (
                  <p className="mt-1 text-[12px] text-red-600">{errors.branchId}</p>
                )}
              </div>
            )}
          </div>

          {serverError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-purple-800 disabled:cursor-wait disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Saving…
                </>
              ) : isEdit ? (
                'Save changes'
              ) : (
                'Add driver'
              )}
            </button>
            <Link
              href={BACK_HREF}
              aria-disabled={submitting}
              tabIndex={submitting ? -1 : undefined}
              onClick={(e) => {
                if (submitting) e.preventDefault()
              }}
              className={`rounded-lg px-4 py-2 text-center text-sm font-medium text-zinc-600 hover:bg-zinc-100 ${submitting ? 'pointer-events-none opacity-50' : ''}`}
            >
              Cancel
            </Link>
          </div>
        </fieldset>
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
