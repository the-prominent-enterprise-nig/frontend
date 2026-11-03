'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  InventoryTabNav,
  type InventoryTab as NavTab,
} from '@/src/components/inventory/InventoryTabNav'
import ItemMasterList from '../../items/_components/ItemMasterList'
import CategoryManager from '../../categories/_components/CategoryManager'
import AttributesPageView from '../../attributes/_components/AttributesPageView'
import UomList from '../../uom/_components/UomList'
import BarcodesPageView from '../../barcodes/_components/BarcodesPageView'
import { BrandsPageView } from '../../brands/_components'
import { TypesPageView } from '../../types/_components'
import { AddItemModal } from '../../items/_components/AddItemModal'
import { can, type SessionUser } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

// Serial Numbers moved to Stock (StockHub) — it's operational data (physical
// units on hand), not a product definition like the rest of this hub's tabs.
// Order follows the Item Master sketch: the onboarding lists first, then
// Barcodes. Items is hidden for now — it moves to POS. Its component and route
// are untouched; set hidden to false to show it again.
const TABS: (NavTab & { hidden?: boolean })[] = [
  { id: 'categories', label: 'Categories' },
  { id: 'brands', label: 'Brands' },
  { id: 'types', label: 'Types' },
  { id: 'attributes', label: 'Attributes' },
  { id: 'units', label: 'Units of Measure' },
  { id: 'items', label: 'Items', hidden: true },
  { id: 'barcodes', label: 'Barcodes' },
]

export function CatalogHub({ session }: { session: SessionUser }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const visible = TABS.filter((t) => !t.hidden)
  const canAddItem = can(session, INVENTORY_PERMISSIONS.ITEMS_CREATE)
  const [addItemOpen, setAddItemOpen] = useState(false)
  const requested = searchParams.get('tab') ?? 'categories'
  const tab = visible.some((t) => t.id === requested) ? requested : 'categories'

  // A hidden ?tab= would show Categories with no tab highlighted, so rewrite
  // the URL to the tab that is actually shown.
  useEffect(() => {
    if (tab !== requested) router.replace(`${pathname}?tab=${tab}`)
  }, [tab, requested, pathname, router])

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <InventoryTabNav
        tabs={visible}
        // Adding an item is Item Master's job, whichever list is open (WH-03).
        actions={
          canAddItem && (
            <button
              type="button"
              onClick={() => setAddItemOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#5b21b6] px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#4a189b]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </button>
          )
        }
      />
      {tab === 'brands' ? (
        <BrandsPageView session={session} />
      ) : tab === 'types' ? (
        <TypesPageView session={session} />
      ) : tab === 'attributes' ? (
        <AttributesPageView session={session} />
      ) : tab === 'units' ? (
        <UomList session={session} />
      ) : tab === 'items' ? (
        <ItemMasterList session={session} />
      ) : tab === 'barcodes' ? (
        <BarcodesPageView session={session} />
      ) : (
        <CategoryManager session={session} />
      )}
      {/* Rendered here, not beside its button: the modal fills its nearest
          positioned ancestor, which inside the sticky tab strip is the strip. */}
      {canAddItem && <AddItemModal open={addItemOpen} onClose={() => setAddItemOpen(false)} />}
    </div>
  )
}
