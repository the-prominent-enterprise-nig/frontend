'use client'

import { useSearchParams } from 'next/navigation'
import { InventoryTabNav } from '@/src/components/inventory/InventoryTabNav'
import StockBalanceList from './StockBalanceList'
import ReservationsPageView from '../../reservations/_components/ReservationsPageView'
import NegativeStockPageView from '../../negative-stock/_components/NegativeStockPageView'
import type { SessionUser } from '@/src/libs/guards/permission'

const TABS = [
  { id: 'balance', label: 'Balance' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'negative', label: 'Negative Stock' },
]

export function StockHub({ session }: { session: SessionUser }) {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'balance'

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <InventoryTabNav tabs={TABS} />
      {tab === 'reservations' ? (
        <ReservationsPageView session={session} />
      ) : tab === 'negative' ? (
        <NegativeStockPageView session={session} />
      ) : (
        <StockBalanceList session={session} />
      )}
    </div>
  )
}
