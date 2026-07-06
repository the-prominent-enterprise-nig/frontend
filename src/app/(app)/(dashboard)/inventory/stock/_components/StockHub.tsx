'use client'

import { useSearchParams } from 'next/navigation'
import { PackageCheck, BookOpen, ClipboardList, Archive, TrendingDown } from 'lucide-react'
import { InventoryTabNav } from '@/src/components/inventory/InventoryTabNav'
import StockBalanceList from './StockBalanceList'
import ReservationsPageView from '../../reservations/_components/ReservationsPageView'
import NegativeStockPageView from '../../negative-stock/_components/NegativeStockPageView'
import StockLedgerTab from '../../goods-receiving/_components/StockLedgerTab'
import ReceivingReportsTab from '../../goods-receiving/_components/ReceivingReportsTab'
import type { SessionUser } from '@/src/libs/guards/permission'

const TABS = [
  { id: 'balance', label: 'Balance', icon: PackageCheck },
  { id: 'ledger', label: 'Stock Ledger', icon: BookOpen },
  { id: 'reports', label: 'Receiving Reports', icon: ClipboardList },
  { id: 'reservations', label: 'Reservations', icon: Archive },
  { id: 'negative', label: 'Negative Stock', icon: TrendingDown },
]

export function StockHub({ session }: { session: SessionUser }) {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'balance'

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <InventoryTabNav tabs={TABS} />
      {tab === 'ledger' ? (
        <div className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">
          <StockLedgerTab />
        </div>
      ) : tab === 'reports' ? (
        <div className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">
          <ReceivingReportsTab />
        </div>
      ) : tab === 'reservations' ? (
        <ReservationsPageView session={session} />
      ) : tab === 'negative' ? (
        <NegativeStockPageView session={session} />
      ) : (
        <StockBalanceList session={session} />
      )}
    </div>
  )
}
