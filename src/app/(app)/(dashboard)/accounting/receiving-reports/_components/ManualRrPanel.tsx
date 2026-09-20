'use client'

/* Scenario 53 — Manual RR, relocated into Accounting and rebuilt into a
 * multi-line, draft-then-post document (see ManualRrForm.tsx's own doc
 * comment). Create and detail are full pages here (manual-rr/new,
 * manual-rr/[id]), not modals — developer feedback, same precedent as
 * Scenario 40 (Expenses) and Scenario 41 (AP Bills) already set for this
 * exact codebase.
 *
 * This used to also render its own separate drafts-only list, but a Manual
 * RR has nowhere to go once posted if that's its only list — the real "All
 * Receipts" table below it (ReceivingReportsTable.tsx) now merges Manual RRs
 * in directly (see getReceivingReports's `includeManual` flag), so this
 * component is just the entry point: create button, then the one list.
 */

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'

export default function ManualRrPanel({ session }: { session: SessionUser }) {
  const canAct =
    hasPermission(session, INVENTORY_PERMISSIONS.MANUAL_RR_CREATE) ||
    hasPermission(session, ACCOUNTING_PERMISSIONS.MANUAL_RR_CREATE)

  if (!canAct) return null

  return (
    <div className="mb-4 flex items-center justify-end">
      <Link
        href="/accounting/receiving-reports/manual-rr/new"
        className="flex items-center gap-2 rounded-lg bg-purple-700 px-3 py-2 text-xs font-medium text-white hover:bg-purple-800"
      >
        <Plus className="h-3.5 w-3.5" />
        Create Receipt
      </Link>
    </div>
  )
}
