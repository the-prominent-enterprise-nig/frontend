'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, BellPlus, Pencil } from 'lucide-react'
import { leadsApi } from '@/src/libs/api/crm'
import ScheduleReminderModal from '@/src/components/crm/ScheduleReminderModal'
import type { Lead, PipelineStage, Interaction, Reminder } from '@/src/schema/crm/types'

type LeadDetailData = Lead & {
  stage: PipelineStage
  interactions: Interaction[]
  reminders: Reminder[]
}

export default function LeadDetail({
  id,
  canConvert,
  canEdit,
  canScheduleReminder,
  currentUserId,
  tenantId,
}: {
  id: string
  canConvert: boolean
  canEdit: boolean
  canScheduleReminder: boolean
  currentUserId: string
  tenantId: string
}) {
  const router = useRouter()
  const [lead, setLead] = useState<LeadDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConvert, setShowConvert] = useState(false)
  const [customerCode, setCustomerCode] = useState('')
  const [converting, setConverting] = useState(false)
  const [reminderOpen, setReminderOpen] = useState(false)

  function reload() {
    leadsApi.get(id).then((res) => {
      if (res.success && res.data) setLead(res.data)
    })
  }

  useEffect(() => {
    leadsApi.get(id).then((res) => {
      if (res.success && res.data) setLead(res.data)
      else setError(res.error ?? 'Lead not found')
      setLoading(false)
    })
  }, [id])

  async function onConvert(e: React.FormEvent) {
    e.preventDefault()
    if (!customerCode.trim()) return
    setConverting(true)
    const res = await leadsApi.convert(id, { customerCode })
    setConverting(false)
    if (res.success && res.data) {
      router.push(`/crm/customers/${res.data.customer.id}`)
    } else {
      setError(res.error ?? 'Conversion failed')
    }
  }

  if (loading) {
    return <div className="px-6 py-8 lg:px-10 text-gray-400">Loading lead…</div>
  }

  if (error || !lead) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <Link
          href="/crm/leads"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to leads
        </Link>
        <p className="text-red-600">{error ?? 'Not found'}</p>
      </div>
    )
  }

  const isConverted = Boolean(lead.convertedToCustomerId)

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/crm/leads"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {[lead.firstName, lead.lastName].filter(Boolean).join(' ')}
          </h1>
          <div className="mt-1 text-sm text-gray-500">
            {lead.company ? `${lead.company} · ` : ''}
            Stage: <span className="font-medium">{lead.stage.name}</span> · Status:{' '}
            <span className="font-medium">{lead.status}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canScheduleReminder && (
            <button
              onClick={() => setReminderOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <BellPlus className="h-4 w-4" />
              Schedule reminder
            </button>
          )}
          {canEdit && (
            <Link
              href={`/crm/leads/${id}/edit`}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          )}
          {canConvert && !isConverted && lead.status === 'active' && (
            <button
              onClick={() => setShowConvert((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700"
            >
              Convert to customer <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
        {isConverted && (
          <Link
            href={`/crm/customers/${lead.convertedToCustomerId}`}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            View customer record
          </Link>
        )}
      </header>

      {showConvert && (
        <form
          onSubmit={onConvert}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-prominent-orange-200 bg-prominent-orange-50/50 p-4"
        >
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[13px] font-medium text-gray-700">Customer code</label>
            <input
              value={customerCode}
              onChange={(e) => setCustomerCode(e.target.value)}
              placeholder="e.g. CUS-0001"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={converting}
            className="rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {converting ? 'Converting…' : 'Confirm conversion'}
          </button>
        </form>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-1">
          <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Contact</h2>
          <dl className="space-y-2 text-[13px]">
            <Row label="Email" value={lead.email ?? '—'} />
            <Row label="Phone" value={lead.phone ?? '—'} />
            <Row label="Source" value={lead.sourceChannel ?? '—'} />
            <Row label="Assigned to" value={lead.assignedTo ?? 'Unassigned'} />
            <Row
              label="Est. value"
              value={lead.estimatedValue ? `₱${Number(lead.estimatedValue).toLocaleString()}` : '—'}
            />
          </dl>
          {lead.notes && (
            <>
              <h3 className="mt-4 text-[13px] font-semibold text-gray-700">Notes</h3>
              <p className="mt-1 whitespace-pre-line text-[13px] text-gray-600">{lead.notes}</p>
            </>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Recent interactions</h2>
          {lead.interactions.length === 0 && (
            <p className="py-6 text-center text-[13px] text-gray-400">
              No interactions logged yet.
            </p>
          )}
          <ul className="divide-y divide-gray-100">
            {lead.interactions.map((i) => (
              <li key={i.id} className="py-3">
                <div className="flex items-center justify-between text-[12px] text-gray-500">
                  <span className="font-medium text-gray-700">{i.interactionType}</span>
                  <span>{new Date(i.occurredAt).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-[13px] text-gray-800">{i.summary}</p>
                {i.outcome && <p className="mt-0.5 text-[12px] text-gray-500">→ {i.outcome}</p>}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Open reminders</h2>
        {lead.reminders.length === 0 && (
          <p className="py-4 text-center text-[13px] text-gray-400">No open reminders.</p>
        )}
        <ul className="divide-y divide-gray-100">
          {lead.reminders.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2.5">
              <div>
                <div className="text-[13px] text-gray-800">{r.note ?? r.reminderType}</div>
                <div className="text-[12px] text-gray-500">
                  Due {new Date(r.dueAt).toLocaleString()} · {r.status}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <ScheduleReminderModal
        open={reminderOpen}
        onClose={() => setReminderOpen(false)}
        onCreated={reload}
        tenantId={tenantId}
        assignedTo={currentUserId}
        target={{ leadId: id }}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-800">{value}</dd>
    </div>
  )
}
