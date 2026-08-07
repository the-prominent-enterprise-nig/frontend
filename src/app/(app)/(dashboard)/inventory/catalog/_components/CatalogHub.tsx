'use client'

import { useSearchParams } from 'next/navigation'
import { InventoryTabNav } from '@/src/components/inventory/InventoryTabNav'
import ItemMasterList from '../../items/_components/ItemMasterList'
import CategoryManager from '../../categories/_components/CategoryManager'
import AttributesPageView from '../../attributes/_components/AttributesPageView'
import UomList from '../../uom/_components/UomList'
import BarcodesPageView from '../../barcodes/_components/BarcodesPageView'
import { SerialNumberList } from '../../serial-numbers/_components'
import { BrandsPageView } from '../../brands/_components'
import { TypesPageView } from '../../types/_components'
import type { SessionUser } from '@/src/libs/guards/permission'

// Serial Numbers is genuinely operational data (physical units, not product
// definitions), but it kept getting missed when it only lived under Stock/
// Counting — this is now its single canonical home (removed from both of
// those, same cleanup StockHub already did) rather than being cross-listed
// with no one obvious place to look.
const TABS = [
  { id: 'items', label: 'Items' },
  { id: 'categories', label: 'Categories' },
  { id: 'brands', label: 'Brands' },
  { id: 'types', label: 'Types' },
  { id: 'attributes', label: 'Attributes' },
  { id: 'units', label: 'Units of Measure' },
  { id: 'barcodes', label: 'Barcodes' },
  { id: 'serials', label: 'Serial Numbers' },
]

export function CatalogHub({ session }: { session: SessionUser }) {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'items'

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <InventoryTabNav tabs={TABS} />
      {tab === 'categories' ? (
        <CategoryManager session={session} />
      ) : tab === 'brands' ? (
        <BrandsPageView session={session} />
      ) : tab === 'types' ? (
        <TypesPageView session={session} />
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
