'use server'

import { api } from '@/src/libs/api/client'

export type ItemBranchAvailability = {
  item: { id: string; name: string; sku: string | null; isSerialTracked: boolean }
  branches: {
    id: string
    name: string
    code: string | null
    city: string | null
    availableQty: number
  }[]
}

/**
 * Where else this item is in stock. Deliberately enterprise-wide rather than
 * branch-scoped — the cashier is asking precisely because their own branch
 * has none. See CatalogController.findItemAvailability.
 */
export async function getItemAvailability(itemId: string) {
  return api.get<ItemBranchAvailability>('/pos/catalog/item-availability', { itemId })
}
