'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { leadsApi, pipelineStagesApi } from '@/src/libs/api/crm'
import { updateLeadSchema, type UpdateLeadInput } from '@/src/schema/crm/lead'
import type { PipelineStage, LeadStatus } from '@/src/schema/crm/types'

type FormState = {
  firstName: string
  lastName: string
  company: string
  email: string
  phone: string
  sourceChannel: string
  stageId: string
  estimatedValue: string
  assignedTo: string
  notes: string
  status: LeadStatus
}

const empty: FormState = {
  firstName: '',
  lastName: '',
  company: '',
  email: '',
  phone: '',
  sourceChannel: '',
  stageId: '',
  estimatedValue: '',
  assignedTo: '',
  notes: '',
  status: 'active',
}

export default function EditLeadForm({ id }: { id: string }) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(empty)
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([leadsApi.get(id), pipelineStagesApi.list()]).then(([leadRes, stagesRes]) => {
      if (stagesRes.success && stagesRes.data) setStages(stagesRes.data)

      if (leadRes.success && leadRes.data) {
        const l = leadRes.data
        setForm({
          firstName: l.firstName,
          lastName: l.lastName ?? '',
          company: l.company ?? '',
          email: l.email ?? '',
          phone: l.phone ?? '',
          sourceChannel: l.sourceChannel ?? '',
          stageId: l.stageId,
          estimatedValue: l.estimatedValue != null ? String(l.estimatedValue) : '',
          assignedTo: l.assignedTo ?? '',
          notes: l.notes ?? '',
          status: l.status,
        })
      } else {
        setServerError(leadRes.error ?? 'Lead not found')
      }
      setLoading(false)
    })
  }, [id])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    // Strip empty strings so they don't overwrite existing values with ""
    const payload: UpdateLeadInput = {
      firstName: form.firstName,
      lastName: form.lastName || undefined,
      company: form.company || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      sourceChannel: form.sourceChannel || undefined,
      stageId: form.stageId,
      estimatedValue: form.estimatedValue === '' ? undefined : Number(form.estimatedValue),
      assignedTo: form.assignedTo || undefined,
      notes: form.notes || undefined,
      status: form.status,
    }

    const parsed = updateLeadSchema.safeParse(payload)
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
    const res = await leadsApi.update(id, parsed.data)
    setSubmitting(false)
    if (res.success) {
      router.push(`/crm/leads/${id}`)
      router.refresh()
    } else {
      setServerError(res.error ?? 'Failed to update lead')
    }
  }

  if (loading) {
    return <div className="px-6 py-8 text-gray-400">Loading lead…</div>
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href={`/crm/leads/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to lead
      </Link>

      <h1 className="text-2xl font-semibold text-gray-900">Edit Lead</h1>
      <p className="mt-1 text-sm text-gray-500">Update contact info, stage, status, or notes.</p>

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
            value={form.lastName}
            onChange={(v) => setField('lastName', v)}
          />
        </div>

        <Field label="Company" value={form.company} onChange={(v) => setField('company', v)} />

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Email"
            error={errors.email}
            value={form.email}
            onChange={(v) => setField('email', v)}
          />
          <Field label="Phone" value={form.phone} onChange={(v) => setField('phone', v)} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Pipeline stage *</label>
            <select
              value={form.stageId}
              onChange={(e) => setField('stageId', e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-700">Status</label>
            <select
              value={form.status}
              onChange={(e) => setField('status', e.target.value as LeadStatus)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <Field
            label="Estimated value (₱)"
            value={form.estimatedValue}
            onChange={(v) => setField('estimatedValue', v)}
          />
        </div>

        <Field
          label="Source channel"
          value={form.sourceChannel}
          onChange={(v) => setField('sourceChannel', v)}
        />

        <div>
          <label className="block text-[13px] font-medium text-gray-700">Notes</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </div>

        {serverError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/crm/leads/${id}`}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:opacity-50"
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
