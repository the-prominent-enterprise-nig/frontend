'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { collectorsApi } from '@/src/libs/api/crm'
import { getBranches } from '../../../_actions/get-branches'
import { updateCollectorSchema, type UpdateCollectorInput } from '@/src/schema/crm/collector'
import type { CollectorStatus } from '@/src/schema/crm/types'

type FormState = {
  stubNumber: string
  name: string
  branchId: string
  status: CollectorStatus
}

const empty: FormState = {
  stubNumber: '',
  name: '',
  branchId: '',
  status: 'active',
}

export default function EditCollectorForm({ id }: { id: string }) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(empty)
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([collectorsApi.get(id), getBranches()]).then(([collectorRes, branchesRes]) => {
      if (branchesRes.success && branchesRes.data) setBranches(branchesRes.data.data)

      if (collectorRes.success && collectorRes.data) {
        const c = collectorRes.data
        setForm({
          stubNumber: c.stubNumber,
          name: c.name,
          branchId: c.branchId ?? '',
          status: c.status,
        })
      } else {
        setServerError(collectorRes.error ?? 'Collector not found')
      }
      setLoading(false)
    })
  }, [id])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    const payload: UpdateCollectorInput = {
      stubNumber: form.stubNumber,
      name: form.name,
      branchId: form.branchId || undefined,
      status: form.status,
    }

    const parsed = updateCollectorSchema.safeParse(payload)
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      parsed.error.issues.forEach((i) => {
        errs[i.path[0] as string] = i.message
      })
      setErrors(errs)
      return
    }
    setErrors({})
    setSubmitting(true)
    const res = await collectorsApi.update(id, parsed.data)
    setSubmitting(false)
    if (res.success) {
      router.push(`/crm/collectors/${id}`)
      router.refresh()
    } else {
      setServerError(res.error ?? 'Failed to update collector')
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-6 text-gray-400 sm:px-6 lg:px-10 lg:py-8">Loading collector…</div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <Link
        href={`/crm/collectors/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to collector
      </Link>

      <h1 className="text-2xl font-semibold text-gray-900">Edit Collector</h1>
      <p className="mt-1 text-sm text-gray-500">Update stub number, branch, or status.</p>

      <form
        onSubmit={onSubmit}
        className="mt-6 max-w-2xl space-y-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Stub number *"
            error={errors.stubNumber}
            value={form.stubNumber}
            onChange={(v) => setField('stubNumber', v)}
          />
          <Field
            label="Name *"
            error={errors.name}
            value={form.name}
            onChange={(v) => setField('name', v)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Branch</label>
            <select
              value={form.branchId}
              onChange={(e) => setField('branchId', e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Unassigned</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-700">Status</label>
            <select
              value={form.status}
              onChange={(e) => setField('status', e.target.value as CollectorStatus)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {serverError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
        )}

        <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-end">
          <Link
            href={`/crm/collectors/${id}`}
            className="w-full rounded-lg px-4 py-2 text-center text-sm font-medium text-gray-600 hover:bg-gray-100 sm:w-auto"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:opacity-50 sm:w-auto"
          >
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-gray-700">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-prominent-orange-400 focus:outline-none"
      />
      {error && <p className="mt-1 text-[12px] text-red-600">{error}</p>}
    </div>
  )
}
