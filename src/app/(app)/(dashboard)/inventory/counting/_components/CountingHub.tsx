'use client'

import { useSearchParams } from 'next/navigation'
import { InventoryTabNav } from '@/src/components/inventory/InventoryTabNav'
import MobileCountInterface from '../../mobile-count/_components/MobileCountInterface'
import BatchList from '../../batches/_components/BatchList'
import AdjustmentList from '../../adjustments/_components/AdjustmentList'
import type { SessionUser } from '@/src/libs/guards/permission'

// Cycle counts are just Stock Counts filtered to countType=cycle (same
// /inventory/counts model, same StockCountList, which already has a Count
// Type filter) — the separate "Cycle Schedules" tab used to duplicate that
// with an incomplete UI (list + start/cancel only, no way to actually open
// a session and fill in the Count Sheet). Adjustments moved here from
// Operations instead, since most of them originate from a count variance.
// Expiry was removed the same way as Cycle Schedules — it only ever read
// /inventory/batches (the exact same endpoints Batches already calls),
// with none of Batches' create/status/hold actions.
// Stock Counts moved to Stock Report → Physical Inventory (Scenario 87);
// counting/page.tsx redirects the bare hub and ?tab=counts there.
const TABS = [
  { id: 'adjustments', label: 'Stock Adjustments' },
  { id: 'mobile', label: 'Mobile Count' },
  { id: 'batches', label: 'Batches' },
  // Manual RR (Scenario 29 RR-05) used to sit here as a fifth tab. Pulled from
  // the UI because it reads as a second, competing "create a receipt" path
  // alongside Receive Stock, which confused the Scenario 50 UAT pass. The
  // components, actions, hooks and backend all still exist and work, but this
  // tab was its ONLY entry point (manual-receiving-reports/ has no page.tsx),
  // so the feature is now unreachable from the UI. Restoring it is a two-line
  // change: re-add the tab entry and the ManualRrList branch below.
]

export function CountingHub({ session }: { session: SessionUser }) {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'adjustments'

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <InventoryTabNav tabs={TABS} />
      {tab === 'mobile' ? (
        <MobileCountInterface session={session} />
      ) : tab === 'batches' ? (
        <BatchList session={session} />
      ) : (
        <AdjustmentList session={session} />
      )}
    </div>
  )
}
