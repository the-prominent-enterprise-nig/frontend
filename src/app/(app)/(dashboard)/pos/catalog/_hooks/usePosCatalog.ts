'use client'

import { useQuery } from '@tanstack/react-query'
import { STALE } from '@/src/libs/query/stale-times'
import { itemLookup } from '../../_actions/pos-actions'

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
  return useQuery({
    queryKey: ['pos-product-catalog', branchId],
    queryFn: async (): Promise<PosCatalogItem[]> => {
      const res = await itemLookup(undefined, branchId ?? undefined)
      if (!res.success) throw new Error(res.error ?? 'Failed to load catalog')
      return (res.data ?? []) as PosCatalogItem[]
    },
    staleTime: STALE.REALTIME,
  })
}
