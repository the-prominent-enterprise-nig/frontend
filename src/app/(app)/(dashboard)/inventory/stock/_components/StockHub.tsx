'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { PackageCheck, BookOpen, ClipboardList, Hash } from 'lucide-react'
import { InventoryTabNav } from '@/src/components/inventory/InventoryTabNav'
import StockBalanceList from './StockBalanceList'
import ReservationsPageView from '../../reservations/_components/ReservationsPageView'
import NegativeStockPageView from '../../negative-stock/_components/NegativeStockPageView'
import StockLedgerTab from '../../goods-receiving/_components/StockLedgerTab'
import ReceivingReportsTab from '../../goods-receiving/_components/ReceivingReportsTab'
import { SerialNumberList } from '../../serial-numbers/_components'
import { can, type SessionUser } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { LocationToken } from '@/src/libs/inventory/location-tokens'

// Serial Numbers moved back here from Catalog — it's operational stock data
// (physical units on hand), so it belongs alongside Balance/Ledger, not the
// product-definition tabs.
// Reservations and Negative Stock stay reachable at ?tab=reservations /
// ?tab=negative (routing below is untouched) — just hidden from the nav.
const TABS = [
  { id: 'balance', label: 'Balance', icon: PackageCheck },
  { id: 'serials', label: 'Serial Numbers', icon: Hash },
  { id: 'ledger', label: 'Stock Ledger', icon: BookOpen },
  { id: 'reports', label: 'Receiving Reports', icon: ClipboardList },
]

export function StockHub({ session }: { session: SessionUser }) {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'balance'

  // Lifted here (rather than local to each tab's hook) because StockHub
  // itself never unmounts across a tab switch — only its children do — so
  // this survives the Balance → Ledger switch and lets Ledger inherit
  // whatever branch/warehouse was last picked on Balance.
  const [sharedLocations, setSharedLocations] = useState<LocationToken[]>([])

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <InventoryTabNav tabs={TABS} />
      {tab === 'serials' ? (
        <SerialNumberList session={session} />
      ) : tab === 'ledger' ? (
        <div className="mx-auto w-full max-w-[1560px] p-[14px] min-[1080px]:px-5 min-[1080px]:py-[22px]">
          <StockLedgerTab
            initialLocations={sharedLocations}
            canAdjust={can(session, INVENTORY_PERMISSIONS.STOCK_ADJUST)}
          />
        </div>
      ) : tab === 'reports' ? (
        <div className="mx-auto w-full max-w-[1560px] p-[14px] min-[1080px]:px-5 min-[1080px]:py-[22px]">
          <ReceivingReportsTab />
        </div>
      ) : tab === 'reservations' ? (
        <ReservationsPageView session={session} />
      ) : tab === 'negative' ? (
        <NegativeStockPageView session={session} />
      ) : (
        <StockBalanceList session={session} onLocationsChange={setSharedLocations} />
      )}
    </div>
  )
}
