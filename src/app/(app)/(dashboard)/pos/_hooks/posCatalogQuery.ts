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
 * Stock can be up to STALE.LOOKUP old on a revisit. Checkout invalidates this
 * key after a sale it posts, so the cashier's own sales are never missing from
 * the next visit; prices are re-resolved at checkout (/pos/catalog/resolve-prices),
 * not read from here.
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
    staleTime: STALE.LOOKUP,
    // Must outlive staleTime, or the entry is collected before it can be reused.
    gcTime: 2 * STALE.LOOKUP,
  })
}
