import type { StockBalance } from '@/src/schema/inventory/goods-receiving'

/**
 * One stock-state vocabulary for every inventory surface — the Stock Balance
 * table, the Item 360 header and its per-location rows used to carry three
 * different sets (and two different "low" rules). The server's
 * `deriveStockState` mirrors `stockStatusOf` below, so a Stock state filter
 * and the badge it matches can never disagree.
 */
export type StockStatus = 'out' | 'fully_reserved' | 'low' | 'in_stock'

export const STOCK_STATUS_META: Record<StockStatus, { label: string; badge: string; dot: string }> =
  {
    out: { label: 'Out of Stock', badge: 'bg-[#fdeceb] text-[#b42318]', dot: 'bg-[#d9544c]' },
    fully_reserved: {
      label: 'Fully Reserved',
      badge: 'bg-[#eaf0fb] text-[#1f4b99]',
      dot: 'bg-[#3b74cc]',
    },
    low: { label: 'Low Stock', badge: 'bg-[#fdf3e7] text-[#8a4b06]', dot: 'bg-[#d18b1d]' },
    in_stock: { label: 'In Stock', badge: 'bg-[#e7f5ef] text-[#0b6644]', dot: 'bg-[#0f7b52]' },
  }

/** Scenario 56 — a second axis, not a fifth state: units on the road toward
 * a location. A row can be In Stock and have more in transit at once. */
export const IN_TRANSIT_META = {
  label: 'In Transit',
  badge: 'bg-[#e8f3fa] text-[#0b5c8a]',
  dot: 'bg-[#2b8ac4]',
}

type BalanceQty = Pick<StockBalance, 'onHandQty' | 'availableQty' | 'reorderPoint'>

/**
 * Out of Stock (nothing on hand) and Fully Reserved (on hand, all committed)
 * are kept apart — a shelf of 40 with 40 reserved isn't an empty shelf. Low
 * means any location's available qty is under its reorder point.
 */
export function stockStatusOf(balances: BalanceQty | BalanceQty[]): StockStatus {
  const rows = Array.isArray(balances) ? balances : [balances]
  const onHand = rows.reduce((s, b) => s + Number(b.onHandQty ?? 0), 0)
  const available = rows.reduce((s, b) => s + Number(b.availableQty ?? 0), 0)
  if (onHand <= 0) return 'out'
  if (available <= 0) return 'fully_reserved'
  const belowReorder = rows.some(
    (b) => b.reorderPoint != null && Number(b.availableQty ?? 0) < Number(b.reorderPoint)
  )
  return belowReorder ? 'low' : 'in_stock'
}

/** Units still travelling toward these locations. */
export function inTransitQtyOf(
  balances: Pick<StockBalance, 'inTransitQty'> | Pick<StockBalance, 'inTransitQty'>[]
): number {
  const rows = Array.isArray(balances) ? balances : [balances]
  return rows.reduce((s, b) => s + Number(b.inTransitQty ?? 0), 0)
}
