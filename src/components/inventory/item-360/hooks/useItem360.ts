'use client'

import { useQuery } from '@tanstack/react-query'
import { getItem } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-item'
import { getItemStockSummary } from '@/src/app/(app)/(dashboard)/inventory/stock/_actions/get-item-stock-summary'
import { getSerialNumbers } from '@/src/app/(app)/(dashboard)/inventory/serial-numbers/_actions/get-serial-numbers'
import type {
  SerialNumberSummary,
  SerialNumberListResponse,
} from '@/src/schema/inventory/serial-numbers'
import type { ApiResponse } from '@/src/libs/api/client'
import { STALE } from '@/src/libs/query/stale-times'
import { splitLocationTokens } from '@/src/libs/inventory/location-tokens'

const SERIAL_PAGE_SIZE = 200
// Safety valve, not a real ceiling — 25 pages at 200/page is 5,000 serials
// for one item, far past anything this catalog actually has. Without a cap
// a backend that never converges (a `total` that keeps growing under us, or
// a bug) would loop forever instead of just showing an incomplete list.
const SERIAL_PAGE_LIMIT = 25

/** Walks every page so the drawer never silently truncates an item's serial
 * list — the old single `limit: 100` call quietly hid anything past the
 * 100th unit with no indication it had. */
async function getAllSerialNumbers(
  itemId: string,
  branchIds: string[],
  warehouseIds: string[]
): Promise<ApiResponse<SerialNumberListResponse>> {
  const all: SerialNumberSummary[] = []
  for (let page = 1; page <= SERIAL_PAGE_LIMIT; page++) {
    const res = await getSerialNumbers({
      itemId,
      page,
      limit: SERIAL_PAGE_SIZE,
      branchIds,
      warehouseIds,
    })
    if (!res.success || !res.data) return res
    all.push(...res.data.data)
    if (all.length >= res.data.total || res.data.data.length < SERIAL_PAGE_SIZE) break
  }
  return { success: true, data: { data: all, total: all.length, page: 1, limit: all.length } }
}

/**
 * @param locations branch:/warehouse: tokens the opening list was filtered
 * to. Scenario 50 — the drawer breaks down the same locations the row it was
 * opened from was summed from; empty means every location.
 */
export function useItem360(itemId: string, activeTab: string, locations?: string[]) {
  const { branchIds, warehouseIds } = splitLocationTokens(locations)
  // Part of the cache key: the same item filtered to different branches is a
  // different answer, and sharing one entry would serve the first-opened
  // scope to every later one.
  const scopeKey = [...branchIds, ...warehouseIds].sort().join(',')

  const item = useQuery({
    queryKey: ['inventory-item-360', itemId, 'overview'],
    queryFn: () => getItem(itemId),
    staleTime: STALE.OPERATIONAL,
    enabled: !!itemId,
  })

  const stock = useQuery({
    queryKey: ['inventory-item-360', itemId, 'stock', scopeKey],
    queryFn: () => getItemStockSummary(itemId, { branchIds, warehouseIds }),
    staleTime: STALE.REALTIME,
    enabled: !!itemId && activeTab === 'stock',
  })

  // The Stock tab shows each location's serial numbers inline (expand a
  // location row to see its units) rather than as a separate tab, so serials
  // load alongside the stock balances rather than gated behind their own tab.
  const serials = useQuery({
    queryKey: ['inventory-item-360', itemId, 'serials', scopeKey],
    queryFn: () => getAllSerialNumbers(itemId, branchIds, warehouseIds),
    staleTime: STALE.OPERATIONAL,
    enabled: !!itemId && activeTab === 'stock',
  })

  return { item, stock, serials }
}
