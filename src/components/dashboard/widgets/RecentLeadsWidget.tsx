'use client'

import { useEffect, useState } from 'react'
import { useWidgetSize } from '../WidgetSizeContext'
import { leadsApi, pipelineStagesApi } from '@/src/libs/api/crm'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-blue-100 text-blue-700',
  won: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-red-100 text-red-600',
  archived: 'bg-zinc-100 text-zinc-600',
}

function fmtMoney(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₱${(n / 1_000).toFixed(0)}K`
  return `₱${Math.round(n).toLocaleString()}`
}

type LeadRow = {
  id: string
  name: string
  stageName: string
  status: string
  estimatedValue: number
  createdAt: string
}

export default function RecentLeadsWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'
  const limit = isCompact ? 3 : 5

  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const branchId = usePosBranchContext((s) => s.branchId)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      leadsApi.list({ limit: 50, page: 1, branchId: branchId ?? undefined }),
      pipelineStagesApi.list(),
    ])
      .then(([leadsRes, stagesRes]) => {
        if (cancelled) return
        const stageNameById = new Map((stagesRes.data ?? []).map((s) => [s.id, s.name] as const))
        const rows: LeadRow[] = (leadsRes.data?.data ?? [])
          .map((l) => ({
            id: l.id,
            name: [l.firstName, l.lastName].filter(Boolean).join(' ') || 'Unnamed Lead',
            stageName: stageNameById.get(l.stageId) ?? '—',
            status: l.status,
            estimatedValue: Number(l.estimatedValue ?? 0),
            createdAt: l.createdAt,
          }))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setLeads(rows)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [branchId])

  if (loading) {
    return (
      <div className="flex flex-col gap-0.5">
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            <div className="flex-1 space-y-1">
              <div className="h-2.5 w-24 rounded bg-zinc-100 animate-pulse" />
              <div className="h-2 w-20 rounded bg-zinc-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4 text-center">
        <p className="text-xs text-zinc-400">No leads yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {leads.slice(0, limit).map((lead) => (
        <div
          key={lead.id}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 transition"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-zinc-800">{lead.name}</p>
            {!isCompact && <p className="truncate text-[10px] text-zinc-500">{lead.stageName}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${STATUS_STYLES[lead.status] ?? 'bg-zinc-100 text-zinc-600'}`}
            >
              {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
            </span>
            <span className="text-xs font-semibold text-zinc-700">
              {fmtMoney(lead.estimatedValue)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
