'use server'

import { api } from '@/src/libs/api/client'
import type { StockBalanceListResponse } from '@/src/schema/inventory/goods-receiving'

export async function getItemStockSummary(
  itemId: string,
  // Scenario 50 — scopes the Item 360 Stock tab to the locations the list it
  // was opened from had filtered to. Omitted means every location.
  scope?: { branchIds?: string[]; warehouseIds?: string[]; region?: 'panay' | 'negros' }
) {
  return api.get<StockBalanceListResponse>('/inventory/stock/balances', {
    itemId,
    limit: 50,
    includeReorderPoints: true,
    branchIds: scope?.branchIds?.length ? scope.branchIds.join(',') : undefined,
    warehouseIds: scope?.warehouseIds?.length ? scope.warehouseIds.join(',') : undefined,
    region: scope?.region,
  })
}
