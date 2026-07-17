'use client'

import { useSearchParams } from 'next/navigation'
import { InventoryTabNav } from '@/src/components/inventory/InventoryTabNav'
import TransferList from '../../transfers/_components/TransferList'
import GoodsReceivingList from '../../goods-receiving/_components/GoodsReceivingList'
import ReturnList from '../../returns/_components/ReturnList'
import QualityHoldList from '../../quality-hold/_components/QualityHoldList'
import BackordersPageView from '../../backorders/_components/BackordersPageView'
import type { SessionUser } from '@/src/libs/guards/permission'

const TABS = [
  { id: 'transfers', label: 'Transfers' },
  { id: 'receiving', label: 'Receiving' },
  { id: 'returns', label: 'Returns' },
  { id: 'quality', label: 'Quality Hold' },
  { id: 'backorders', label: 'Backorders' },
]

export function OperationsHub({ session }: { session: SessionUser }) {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'transfers'

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <InventoryTabNav tabs={TABS} />
      {tab === 'receiving' ? (
        <GoodsReceivingList session={session} />
      ) : tab === 'returns' ? (
        <ReturnList session={session} />
      ) : tab === 'quality' ? (
        <QualityHoldList session={session} />
      ) : tab === 'backorders' ? (
        <BackordersPageView session={session} />
      ) : (
        <TransferList session={session} />
      )}
    </div>
  )
}
