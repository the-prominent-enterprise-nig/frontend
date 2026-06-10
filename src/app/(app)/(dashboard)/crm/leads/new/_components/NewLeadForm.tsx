'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { leadsApi, pipelineStagesApi } from '@/src/libs/api/crm'
import { createLeadSchema, type CreateLeadInput } from '@/src/schema/crm/lead'
import type { PipelineStage } from '@/src/schema/crm/types'

const initial: CreateLeadInput = {
  tenantId: '',
  firstName: '',
  lastName: '',
  company: '',
  email: '',
  phone: '',
  sourceChannel: '',
  stageId: '',
  estimatedValue: undefined,
  assignedTo: '',
  notes: '',
}

export default function NewLeadForm({ tenantId }: { tenantId: string }) {
  const router = useRouter()
  const [form, setForm] = useState<CreateLeadInput>({ ...initial, tenantId })
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    pipelineStagesApi.list().then((res) => {
      if (res.success && res.data) {
        setStages(res.data)
        if (res.data[0]) setForm((f) => ({ ...f, stageId: res.data![0].id }))
      }
    })
  }, [])

  const setField = <K extends keyof CreateLeadInput>(key: K, value: CreateLeadInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    const parsed = createLeadSchema.safeParse(form)
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
    const res = await leadsApi.create(parsed.data)
    setSubmitting(false)
    if (res.success && res.data) {
      router.push(`/crm/leads/${res.data.id}`)
    } else {
      setServerError(res.error ?? 'Failed to create lead')
    }
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/crm/leads"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to leads
      </Link>

      <h1 className="text-2xl font-semibold text-gray-900">New Lead</h1>
      <p className="mt-1 text-sm text-gray-500">
        Capture contact details and assign to a pipeline stage.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-6 max-w-2xl space-y-5 rounded-xl border border-gray-200 bg-white p-6"
      >
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="First name *"
            error={errors.firstName}
            value={form.firstName}
            onChange={(v) => setField('firstName', v)}
          />
          <Field
            label="Last name"
            error={errors.lastName}
            value={form.lastName ?? ''}
            onChange={(v) => setField('lastName', v)}
          />
        </div>

        <Field
          label="Company"
          value={form.company ?? ''}
          onChange={(v) => setField('company', v)}
        />

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Email"
            error={errors.email}
            value={form.email ?? ''}
            onChange={(v) => setField('email', v)}
          />
          <Field label="Phone" value={form.phone ?? ''} onChange={(v) => setField('phone', v)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Pipeline stage *</label>
            <select
              value={form.stageId}
              onChange={(e) => setField('stageId', e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select a stage…</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {errors.stageId && <p className="mt-1 text-[12px] text-red-600">{errors.stageId}</p>}
          </div>

          <Field
            label="Estimated value (₱)"
            value={form.estimatedValue?.toString() ?? ''}
            onChange={(v) => setField('estimatedValue', v === '' ? undefined : Number(v))}
          />
        </div>

        <Field
          label="Source channel"
          value={form.sourceChannel ?? ''}
          onChange={(v) => setField('sourceChannel', v)}
        />

        <div>
          <label className="block text-[13px] font-medium text-gray-700">Notes</label>
          <textarea
            rows={3}
            value={form.notes ?? ''}
            onChange={(e) => setField('notes', e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </div>

        {serverError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/crm/leads"
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create lead'}
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
