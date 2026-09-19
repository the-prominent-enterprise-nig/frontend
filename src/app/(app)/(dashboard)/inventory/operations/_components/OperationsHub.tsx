'use client'

import { useSearchParams } from 'next/navigation'
import { InventoryTabNav } from '@/src/components/inventory/InventoryTabNav'
import TransferList from '../../transfers/_components/TransferList'
import ReturnList from '../../returns/_components/ReturnList'
import QualityHoldList from '../../quality-hold/_components/QualityHoldList'
import BackordersPageView from '../../backorders/_components/BackordersPageView'
import type { SessionUser } from '@/src/libs/guards/permission'

// Stock Adjustments moved to the Counting hub (/inventory/counting?tab=adjustments)
// — most adjustments originate from a count variance, so it lives next to
// the count sessions that create them.
//
// Receiving moved to the Stock hub. Its tab here was a second stock-balance
// list over the same /inventory/stock/balances endpoint the Stock hub's
// Balance tab reads, with fewer filters and no item roll-up, plus a "Receive
// Stock" button that the Stock hub's own Receiving Reports tab already
// carries ("New Receipt", same ReceiveStockModal, same permission). Receiving
// documents had already been consolidated there — /inventory/goods-receiving/[id]
// redirects to /inventory/stock/reports/[id], which five screens deep-link
// into — so this tab was the last piece left on the other side.
const TABS = [
  { id: 'transfers', label: 'Transfers' },
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
      {tab === 'returns' ? (
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
