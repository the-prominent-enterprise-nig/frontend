'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PackageCheck, Hash, Search } from 'lucide-react'
import { InventoryTabNav } from '@/src/components/inventory/InventoryTabNav'
import StockBalanceList from './StockBalanceList'
import ReservationsPageView from '../../reservations/_components/ReservationsPageView'
import NegativeStockPageView from '../../negative-stock/_components/NegativeStockPageView'
import { SerialNumberList } from '../../serial-numbers/_components'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { LocationToken } from '@/src/libs/inventory/location-tokens'

// Serial Numbers moved back here from Catalog — it's operational stock data
// (physical units on hand), so it belongs alongside Balance/Ledger, not the
// product-definition tabs.
// Reservations and Negative Stock stay reachable at ?tab=reservations /
// ?tab=negative (routing below is untouched) — just hidden from the nav.
const TABS = [
  { id: 'balance', label: 'Stock Balance', icon: PackageCheck },
  { id: 'serials', label: 'General Stockbook', icon: Hash },
  { id: 'locator', label: 'Serial Number Locator', icon: Search },
]

export function StockHub({ session }: { session: SessionUser }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // The Ledger tab folded into Balance; an old ?tab=ledger link lands on Balance.
  const requested = searchParams.get('tab') ?? 'balance'
  const tab = requested === 'ledger' ? 'balance' : requested

  // Receiving Reports moved to Stock Transaction; old links land there, keeping
  // any ?new=1 so "create a receiving report" still opens the form.
  useEffect(() => {
    if (requested === 'ledger') router.replace(`${pathname}?tab=balance`)
    if (requested === 'reports') {
      const next = new URLSearchParams(searchParams.toString())
      next.set('tab', 'receiving')
      router.replace(`/inventory/stock-transaction?${next.toString()}`)
    }
  }, [requested, pathname, router, searchParams])

  // Lifted here (rather than local to each tab's hook) because StockHub
  // itself never unmounts across a tab switch — only its children do — so
  // this survives the Balance → Ledger switch and lets Ledger inherit
  // whatever branch/warehouse was last picked on Balance.
  const [, setSharedLocations] = useState<LocationToken[]>([])

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <InventoryTabNav tabs={TABS} />
      {tab === 'serials' ? (
        <SerialNumberList key="stockbook" session={session} />
      ) : tab === 'locator' ? (
        <SerialNumberList key="locator" session={session} mode="locator" />
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
