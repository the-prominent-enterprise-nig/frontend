'use client'

/* Scenario 53 — Manual RR, relocated into Accounting and rebuilt into a
 * multi-line, draft-then-post document (see ManualRrForm.tsx's own doc
 * comment). Create and detail are full pages here (manual-rr/new,
 * manual-rr/[id]), not modals — developer feedback, same precedent as
 * Scenario 40 (Expenses) and Scenario 41 (AP Bills) already set for this
 * exact codebase. This panel is just the open-drafts list + entry point,
 * alongside the read-only Receiving Reports table above it.
 */

import { useEffect } from 'react'
import Link from 'next/link'
import { Plus, FileClock, ChevronRight } from 'lucide-react'
import { useManualReceivingReports } from '../../../inventory/manual-receiving-reports/_hooks/useManualReceivingReports'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'

export default function ManualRrPanel({ session }: { session: SessionUser }) {
  const canAct =
    hasPermission(session, INVENTORY_PERMISSIONS.MANUAL_RR_CREATE) ||
    hasPermission(session, ACCOUNTING_PERMISSIONS.MANUAL_RR_CREATE)

  const { reports, isLoading, statusFilter, setStatusFilter } = useManualReceivingReports()

  // This panel only ever shows open drafts still waiting to be posted — the
  // full history (posted too) already lives on the table above it, sourced
  // from a different endpoint.
  useEffect(() => {
    if (statusFilter !== 'draft') setStatusFilter('draft')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!canAct && reports.length === 0) return null

  return (
    <div className="mb-6 rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-prominent-purple-900">
            Manual Receiving Reports — Drafts
          </h2>
          <p className="text-xs text-zinc-500">
            Originated with no PO/transfer/count context — post them yourself when ready.
          </p>
        </div>
        {canAct && (
          <Link
            href="/accounting/receiving-reports/manual-rr/new"
            className="flex items-center gap-2 rounded-lg bg-prominent-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-prominent-purple-700"
          >
            <Plus className="h-3.5 w-3.5" />
            New Manual RR
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="px-5 py-6 text-xs text-zinc-400">Loading…</div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-8">
          <FileClock className="mb-2 h-6 w-6 text-zinc-300" />
          <p className="text-xs text-zinc-400">No open drafts right now.</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {reports.map((r) => {
            const firstLine = r.lines[0]
            const itemLabel = firstLine
              ? (firstLine.item?.name ?? firstLine.newItemName ?? '—')
              : '—'
            const extraLines = r.lines.length - 1
            return (
              <Link
                key={r.id}
                href={`/accounting/receiving-reports/manual-rr/${r.id}`}
                className="flex w-full items-center gap-4 px-5 py-3 text-left text-sm hover:bg-zinc-50"
              >
                <span className="font-mono text-xs font-semibold text-zinc-500">{r.code}</span>
                <span className="flex-1 truncate">
                  <span className="font-medium text-zinc-900">{itemLabel}</span>
                  {extraLines > 0 && (
                    <span className="ml-1 font-mono text-xs text-zinc-400">+{extraLines} more</span>
                  )}
                </span>
                <span className="text-xs text-zinc-400">{r.createdByName ?? r.createdById}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
