import { queryOptions } from '@tanstack/react-query'
import { STALE } from '@/src/libs/query/stale-times'
import { itemLookup } from '../_actions/pos-actions'

/**
 * The branch's whole sellable catalog — every active item, every page — is
 * around 5 MB, and all of it travels Vercel's function → CDN leg on each load
 * (billed as Fast Origin Transfer). Checkout and the Product Catalog page read
 * it through this one cache entry, so coming back to either within the window
 * costs nothing instead of another full download.
 *
 * Stock changes underneath an open till, though — a stock request received,
 * a unit registered or transferred, often by the same person in another tab —
 * and a cashier must not have to reload the page to see it. So the copy goes
 * stale after STALE.REALTIME and is re-read when the till is opened again or
 * its browser tab regains focus (the cashier coming back from Inventory). No
 * interval polling: at ~5 MB a load, re-reading on a timer while a till sits
 * idle is exactly the transfer this cache exists to save. Checkout also
 * invalidates this key after a sale it posts; prices are re-resolved at
 * checkout (/pos/catalog/resolve-prices), not read from here.
 */
export const POS_CATALOG_KEY = 'pos-product-catalog'

export function posCatalogQueryOptions(branchId: string | null | undefined) {
  return queryOptions({
    queryKey: [POS_CATALOG_KEY, branchId ?? null] as const,
    queryFn: async (): Promise<unknown[]> => {
      const res = await itemLookup(undefined, branchId ?? undefined)
      if (!res.success) throw new Error(res.error ?? 'Failed to load catalog')
      return res.data ?? []
    },
    staleTime: STALE.REALTIME,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    // Kept around well past staleTime so a revisit paints the last copy at
    // once and refreshes it in the background, instead of a blank list.
    gcTime: 2 * STALE.LOOKUP,
  })
}
