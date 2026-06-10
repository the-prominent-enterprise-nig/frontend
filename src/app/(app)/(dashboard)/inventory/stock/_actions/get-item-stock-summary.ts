'use server'

import { api } from '@/src/libs/api/client'
import type { StockBalanceListResponse } from '@/src/schema/inventory/goods-receiving'

export async function getItemStockSummary(itemId: string) {
  return api.get<StockBalanceListResponse>('/inventory/stock/balances', {
    itemId,
    limit: 50,
    includeReorderPoints: true,
  })
}
