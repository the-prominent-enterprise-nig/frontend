'use server'

import { api } from '@/src/libs/api/client'
import type { StockBalanceListResponse } from '@/src/schema/inventory/goods-receiving'

type Params = {
  page?: number
  limit?: number
  itemId?: string
  warehouseId?: string
  categoryId?: string
  search?: string
  belowReorder?: boolean
}

export async function getStockBalances(params: Params = {}) {
  const query: Record<string, string | number | boolean | undefined> = {
    page: params.page,
    limit: params.limit,
    itemId: params.itemId,
    warehouseId: params.warehouseId,
    categoryId: params.categoryId,
    search: params.search,
    belowReorder: params.belowReorder,
  }

  return api.get<StockBalanceListResponse>('/inventory/stock/balances', query, {
    tags: ['inventory-stock-balances'],
  })
}
