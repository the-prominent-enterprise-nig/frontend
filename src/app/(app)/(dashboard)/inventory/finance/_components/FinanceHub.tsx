'use client'

import { useSearchParams } from 'next/navigation'
import { InventoryTabNav } from '@/src/components/inventory/InventoryTabNav'
import CostingPageView from '../../costing/_components/CostingPageView'
import PriceListsPageView from '../../price-lists/_components/PriceListsPageView'
import LandedCostPageView from '../../landed-cost/_components/LandedCostPageView'
import RevaluationPageView from '../../revaluation/_components/RevaluationPageView'
import type { SessionUser } from '@/src/libs/guards/permission'

const TABS = [
  { id: 'costing', label: 'Costing & COGS' },
  { id: 'pricing', label: 'Price Lists' },
  { id: 'landed-cost', label: 'Landed Cost' },
  { id: 'revaluation', label: 'Revaluation' },
]

export function FinanceHub({ session }: { session: SessionUser }) {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'costing'

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <InventoryTabNav tabs={TABS} />
      {tab === 'pricing' ? (
        <PriceListsPageView session={session} />
      ) : tab === 'landed-cost' ? (
        <LandedCostPageView session={session} />
      ) : tab === 'revaluation' ? (
        <RevaluationPageView session={session} />
      ) : (
        <CostingPageView session={session} />
      )}
    </div>
  )
}
