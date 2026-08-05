'use client'

import { useSearchParams } from 'next/navigation'
import { InventoryTabNav } from '@/src/components/inventory/InventoryTabNav'
import StockCountList from '../../stock-counts/_components/StockCountList'
import MobileCountInterface from '../../mobile-count/_components/MobileCountInterface'
import BatchList from '../../batches/_components/BatchList'
import SerialNumberList from '../../serial-numbers/_components/SerialNumberList'
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
const TABS = [
  { id: 'counts', label: 'Stock Counts' },
  { id: 'adjustments', label: 'Stock Adjustments' },
  { id: 'mobile', label: 'Mobile Count' },
  { id: 'batches', label: 'Batches' },
  { id: 'serials', label: 'Serial Numbers' },
]

export function CountingHub({ session }: { session: SessionUser }) {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'counts'

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <InventoryTabNav tabs={TABS} />
      {tab === 'adjustments' ? (
        <AdjustmentList session={session} />
      ) : tab === 'mobile' ? (
        <MobileCountInterface session={session} />
      ) : tab === 'batches' ? (
        <BatchList session={session} />
      ) : tab === 'serials' ? (
        <SerialNumberList session={session} />
      ) : (
        <StockCountList session={session} />
      )}
    </div>
  )
}
