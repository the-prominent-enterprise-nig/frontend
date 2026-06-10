'use client'

import { useSearchParams } from 'next/navigation'
import { InventoryTabNav } from '@/src/components/inventory/InventoryTabNav'
import ReorderDashboard from '../../reorder/_components/ReorderDashboard'
import StockLevelsPageView from '../../stock-levels/_components/StockLevelsPageView'
import ProjectionPageView from '../../projection/_components/ProjectionPageView'
import type { SessionUser } from '@/src/libs/guards/permission'

const TABS = [
  { id: 'reorder', label: 'Reorder Rules' },
  { id: 'stock-levels', label: 'Stock Levels' },
  { id: 'projection', label: 'Projection' },
]

export function PlanningHub({ session }: { session: SessionUser }) {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'reorder'

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <InventoryTabNav tabs={TABS} />
      {tab === 'stock-levels' ? (
        <StockLevelsPageView session={session} />
      ) : tab === 'projection' ? (
        <ProjectionPageView session={session} />
      ) : (
        <ReorderDashboard session={session} />
      )}
    </div>
  )
}
