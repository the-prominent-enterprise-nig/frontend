import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import type { ItemSearchMeta } from '../../../purchase-requests/_components/ItemSearchCombobox'
import { getItem } from '../../../items/_actions/get-item'

type Args = {
  isOpen: boolean
  /** The item named by the link (Item 360's "Receive Stock" → `?item=`). */
  itemId: string | null | undefined
  /** Puts the item on the receipt's first line, as if it had been picked. */
  onItem: (option: SearchComboboxOption) => void
}

/**
 * A receipt opened for one item — Stock Balance → item → Receive Stock, the
 * way a new 0-stock item from Master Data gets its first units. Fetched on
 * its own rather than looked up in the form's catalogue, which loads only the
 * first 500 active items. Fires once per open.
 */
export function useItemPreset({ isOpen, itemId, onItem }: Args): void {
  const done = useRef(false)
  const item = useQuery({
    queryKey: ['inventory-item', itemId ?? ''],
    queryFn: () => getItem(itemId ?? ''),
    enabled: isOpen && !!itemId,
  })

  useEffect(() => {
    if (!isOpen) done.current = false
  }, [isOpen])

  useEffect(() => {
    const data = item.data?.success ? item.data.data : null
    if (!isOpen || !data || done.current) return
    done.current = true
    const meta: ItemSearchMeta = {
      costPrice: data.costPrice != null ? Number(data.costPrice) : null,
      isSerialTracked: Boolean(data.isSerialTracked),
      isBatchTracked: Boolean(data.isBatchTracked),
      modelNumber: data.modelNumber ?? null,
      brandName: data.brand?.name ?? null,
    }
    onItem({ id: data.id, primary: data.name, secondary: data.sku, meta })
  })
}
