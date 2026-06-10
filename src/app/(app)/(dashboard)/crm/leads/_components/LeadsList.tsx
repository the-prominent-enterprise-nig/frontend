'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BellPlus, Plus, Search } from 'lucide-react'
import { leadsApi, pipelineStagesApi } from '@/src/libs/api/crm'
import ScheduleReminderModal from '@/src/components/crm/ScheduleReminderModal'
import type { Lead, PipelineStage } from '@/src/schema/crm/types'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-blue-50 text-blue-700 ring-blue-200',
  won: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  lost: 'bg-red-50 text-red-700 ring-red-200',
  archived: 'bg-gray-100 text-gray-600 ring-gray-200',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600 ring-gray-200'
      }`}
    >
      {status}
    </span>
  )
}

function StageChip({ name, isWon, isLost }: { name: string; isWon?: boolean; isLost?: boolean }) {
  const tone = isWon
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : isLost
      ? 'bg-red-50 text-red-700 ring-red-200'
      : 'bg-prominent-orange-50 text-prominent-orange-700 ring-prominent-orange-200'
  return (
    <span
      className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tone}`}
    >
      {name}
    </span>
  )
}

function initials(first: string, last?: string | null): string {
  const a = first?.[0] ?? ''
  const b = last?.[0] ?? ''
  return (a + b).toUpperCase() || '·'
}

export default function LeadsList({
  canCreate,
  canScheduleReminder,
  currentUserId,
  tenantId,
}: {
  canCreate: boolean
  canScheduleReminder: boolean
  currentUserId: string
  tenantId: string
}) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [stageFilter, setStageFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reminderForLeadId, setReminderForLeadId] = useState<string | null>(null)

  useEffect(() => {
    pipelineStagesApi.list().then((res) => {
      if (res.success && res.data) setStages(res.data)
    })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      setError(null)
      const res = await leadsApi.list({
        search: search || undefined,
        status: statusFilter || undefined,
        stageId: stageFilter || undefined,
        limit: 50,
      })
      if (controller.signal.aborted) return
      if (res.success && res.data) setLeads(res.data.data)
      else setError(res.error ?? 'Failed to load leads')
      setLoading(false)
    }, 250)
    return () => {
      controller.abort()
      clearTimeout(t)
    }
  }, [search, statusFilter, stageFilter])

  const stageById = (id: string) => stages.find((s) => s.id === id)

  return (
    <div className="px-6 py-8 lg:px-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Leads</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track every prospect from first touch to conversion.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/crm/leads/new"
            className="inline-flex items-center gap-2 rounded-xl bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-prominent-orange-700"
          >
            <Plus className="h-4 w-4" />
            New lead
          </Link>
        )}
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, company…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-prominent-orange-400 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All stages</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3 text-right">Value</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              {canScheduleReminder && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-800">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-red-500">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && leads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  No leads match these filters yet.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              leads.map((lead) => {
                const stage = stageById(lead.stageId)
                return (
                  <tr key={lead.id} className="group transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-prominent-orange-100 text-[12px] font-semibold text-prominent-orange-700">
                          {initials(lead.firstName, lead.lastName)}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/crm/leads/${lead.id}`}
                            className="block font-medium text-gray-900 hover:text-prominent-orange-700 hover:underline"
                          >
                            {[lead.firstName, lead.lastName].filter(Boolean).join(' ')}
                          </Link>
                          <div className="truncate text-[12px] text-gray-500">
                            {lead.email ?? lead.phone ?? '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">
                      {lead.company ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {stage ? (
                        <StageChip
                          name={stage.name}
                          isWon={stage.isWonStage}
                          isLost={stage.isLostStage}
                        />
                      ) : (
                        <span className="text-[13px] text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[13px] font-medium text-gray-900">
                      {lead.estimatedValue ? (
                        `₱${Number(lead.estimatedValue).toLocaleString()}`
                      ) : (
                        <span className="font-normal text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-4 py-3 text-[12px] text-gray-500">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                    {canScheduleReminder && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setReminderForLeadId(lead.id)}
                          className="rounded-lg p-1.5 text-gray-400 opacity-0 transition-opacity hover:bg-prominent-orange-50 hover:text-prominent-orange-700 group-hover:opacity-100"
                          title="Schedule reminder"
                          aria-label="Schedule reminder"
                        >
                          <BellPlus className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {canScheduleReminder && (
        <ScheduleReminderModal
          open={reminderForLeadId !== null}
          onClose={() => setReminderForLeadId(null)}
          tenantId={tenantId}
          assignedTo={currentUserId}
          target={reminderForLeadId ? { leadId: reminderForLeadId } : { leadId: '' }}
        />
      )}
    </div>
  )
}
