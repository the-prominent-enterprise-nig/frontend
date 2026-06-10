'use client'

import { useSearchParams } from 'next/navigation'
import { InventoryTabNav } from '@/src/components/inventory/InventoryTabNav'
import StockCountList from '../../stock-counts/_components/StockCountList'
import CycleCountList from '../../cycle-counts/_components/CycleCountList'
import MobileCountInterface from '../../mobile-count/_components/MobileCountInterface'
import BatchList from '../../batches/_components/BatchList'
import SerialNumberList from '../../serial-numbers/_components/SerialNumberList'
import ExpiryDashboard from '../../expiry/_components/ExpiryDashboard'
import type { SessionUser } from '@/src/libs/guards/permission'

const TABS = [
  { id: 'counts', label: 'Stock Counts' },
  { id: 'cycles', label: 'Cycle Schedules' },
  { id: 'mobile', label: 'Mobile Count' },
  { id: 'batches', label: 'Batches' },
  { id: 'serials', label: 'Serial Numbers' },
  { id: 'expiry', label: 'Expiry' },
]

export function CountingHub({ session }: { session: SessionUser }) {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'counts'

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <InventoryTabNav tabs={TABS} />
      {tab === 'cycles' ? (
        <CycleCountList session={session} />
      ) : tab === 'mobile' ? (
        <MobileCountInterface session={session} />
      ) : tab === 'batches' ? (
        <BatchList session={session} />
      ) : tab === 'serials' ? (
        <SerialNumberList session={session} />
      ) : tab === 'expiry' ? (
        <ExpiryDashboard />
      ) : (
        <StockCountList session={session} />
      )}
    </div>
  )
}
