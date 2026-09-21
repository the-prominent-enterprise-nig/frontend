import { useQuery } from '@tanstack/react-query'
import { STALE } from '@/src/libs/query/stale-times'
import type { StockBalance } from '@/src/schema/inventory/goods-receiving'
import type { ItemSummary } from '@/src/schema/inventory/items'
import { getStockBalances } from '../../stock/_actions/get-stock-balances'

/**
 * Scenario 56 — one roll-up row per item on the current Item Master page,
 * fetched in a single request, so each row can show its stock badge.
 * `undefined` when the caller can't read stock (or the fetch failed): the
 * Stock column is hidden rather than showing every item as out of stock.
 */
export function useItemStockStatus(items: ItemSummary[]): Map<string, StockBalance> | undefined {
  const itemIds = items.filter((i) => !i.isService).map((i) => i.id)
  const query = useQuery({
    queryKey: ['item-master-stock-status', itemIds],
    queryFn: () => getStockBalances({ itemIds, groupBy: 'item', limit: itemIds.length }),
    enabled: itemIds.length > 0,
    staleTime: STALE.REALTIME,
  })
  if (!query.data?.success || !query.data.data) return undefined
  const rows = query.data.data.data
  const requested = new Set(itemIds)
  // A missing row reads as Out of Stock, so only trust a response that
  // actually honoured the filter — a backend without `itemIds` support
  // silently drops it and returns the tenant's first page instead, which
  // would badge every other item on this page as out of stock.
  if (rows.some((b) => !requested.has(b.itemId ?? b.item?.id ?? ''))) return undefined
  return new Map(rows.map((b) => [b.itemId ?? b.item?.id ?? '', b]))
}
