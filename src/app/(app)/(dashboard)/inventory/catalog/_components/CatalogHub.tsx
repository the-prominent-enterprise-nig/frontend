'use client'

import { useSearchParams } from 'next/navigation'
import { InventoryTabNav } from '@/src/components/inventory/InventoryTabNav'
import ItemMasterList from '../../items/_components/ItemMasterList'
import CategoryManager from '../../categories/_components/CategoryManager'
import AttributesPageView from '../../attributes/_components/AttributesPageView'
import UomList from '../../uom/_components/UomList'
import BarcodesPageView from '../../barcodes/_components/BarcodesPageView'
import type { SessionUser } from '@/src/libs/guards/permission'

const TABS = [
  { id: 'items', label: 'Items' },
  { id: 'categories', label: 'Categories' },
  { id: 'attributes', label: 'Attributes' },
  { id: 'units', label: 'Units of Measure' },
  { id: 'barcodes', label: 'Barcodes' },
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
      ) : (
        <ItemMasterList session={session} />
      )}
    </div>
  )
}
