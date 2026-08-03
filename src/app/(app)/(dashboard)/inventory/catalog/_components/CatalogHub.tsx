'use client'

import { useSearchParams } from 'next/navigation'
import { Hash } from 'lucide-react'
import { InventoryTabNav } from '@/src/components/inventory/InventoryTabNav'
import ItemMasterList from '../../items/_components/ItemMasterList'
import CategoryManager from '../../categories/_components/CategoryManager'
import AttributesPageView from '../../attributes/_components/AttributesPageView'
import UomList from '../../uom/_components/UomList'
import BarcodesPageView from '../../barcodes/_components/BarcodesPageView'
import { SerialNumberList } from '../../serial-numbers/_components'
import type { SessionUser } from '@/src/libs/guards/permission'

// Serial Numbers also lives under Stock (StockHub) — it's genuinely
// operational data (physical units, not product definitions), but it kept
// getting missed from here, so it's surfaced as a tab in both places rather
// than only being reachable from a page that doesn't obviously connect to
// "importing/managing my catalog".
const TABS = [
  { id: 'items', label: 'Items' },
  { id: 'categories', label: 'Categories' },
  { id: 'attributes', label: 'Attributes' },
  { id: 'units', label: 'Units of Measure' },
  { id: 'barcodes', label: 'Barcodes' },
  { id: 'serials', label: 'Serial Numbers', icon: Hash },
]

export function CatalogHub({ session }: { session: SessionUser }) {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'items'

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <InventoryTabNav tabs={TABS} />
      {tab === 'categories' ? (
        <CategoryManager session={session} />
      ) : tab === 'attributes' ? (
        <AttributesPageView session={session} />
      ) : tab === 'units' ? (
        <UomList session={session} />
      ) : tab === 'barcodes' ? (
        <BarcodesPageView session={session} />
      ) : tab === 'serials' ? (
        <SerialNumberList session={session} />
      ) : (
        <ItemMasterList session={session} />
      )}
    </div>
  )
}
