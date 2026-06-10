'use server'

import { api } from '@/src/libs/api/client'
import type { StockBalanceListResponse } from '@/src/schema/inventory/goods-receiving'

type Params = {
  page?: number
  limit?: number
  itemId?: string
  warehouseId?: string
  search?: string
}

export async function getStockBalances(params: Params = {}) {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
    itemId: params.itemId,
    warehouseId: params.warehouseId,
    search: params.search,
  }

  return api.get<StockBalanceListResponse>('/inventory/stock/balances', query)
}
