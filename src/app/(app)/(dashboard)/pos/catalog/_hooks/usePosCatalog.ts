'use client'

import { useQuery } from '@tanstack/react-query'
import { posCatalogQueryOptions } from '../../_hooks/posCatalogQuery'

/** One sellable item as the POS catalog endpoint returns it. Stock and price
 * are already resolved for the branch the request was made for. */
export interface PosCatalogItem {
  id: string
  sku?: string
  name: string
  description?: string | null
  imageUrl?: string | null
  price: number
  stockQty?: number
  category?: { id: string; name: string } | null
  brand?: { id: string; name: string } | null
  modelNumber?: string | null
  unit?: { id: string; code: string; name: string } | null
}

export function usePosCatalog(branchId: string | null) {
  // Shares one cache entry with Checkout — see posCatalogQueryOptions.
  return useQuery({
    ...posCatalogQueryOptions(branchId),
    select: (rows) => rows as PosCatalogItem[],
  })
}
